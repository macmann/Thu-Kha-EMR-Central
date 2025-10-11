import crypto from 'crypto';
import fs from 'fs';
import https, { type RequestOptions } from 'https';
import path from 'path';
import { Readable } from 'stream';
import { lookup as lookupMime } from 'mime-types';
import { ObjectId, Binary } from 'mongodb';
import {
  DoctorNoteStorageType,
  PrismaClient,
  type DoctorNote,
} from '@prisma/client';
import { getMongoCollection } from './mongoClient.js';

export type DoctorNoteMetadata = {
  id: string;
  visitId: string;
  tenantId: string;
  patientId: string;
  storageType: DoctorNoteStorageType;
  storageKey: string;
  fileName: string | null;
  contentType: string | null;
  size: number;
  createdAt: Date;
  extractedText: string | null;
};

export type DoctorNoteContent = {
  stream: Readable;
  size: number;
  contentType: string;
  fileName: string | null;
  source: DoctorNoteStorageType;
};

type MongoDoctorNoteDocument = {
  _id: ObjectId;
  visitId: string;
  tenantId: string;
  patientId: string;
  filename: string | null;
  contentType: string | null;
  size: number;
  data: Binary;
  createdAt: Date;
};

type S3Config = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  endpoint?: string;
};

let cachedS3Config: S3Config | null = null;

function getS3Config(): S3Config | null {
  if (cachedS3Config) {
    return cachedS3Config;
  }

  const region = process.env.DOCTOR_NOTES_S3_REGION ?? process.env.AWS_REGION;
  const accessKeyId = process.env.DOCTOR_NOTES_S3_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.DOCTOR_NOTES_S3_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.DOCTOR_NOTES_S3_SESSION_TOKEN ?? process.env.AWS_SESSION_TOKEN;
  const endpoint = process.env.DOCTOR_NOTES_S3_ENDPOINT ?? process.env.AWS_S3_ENDPOINT;

  if (!region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  cachedS3Config = {
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken: sessionToken || undefined,
    endpoint: endpoint || undefined,
  };
  return cachedS3Config;
}

export async function getDoctorNotesForVisit(
  prisma: PrismaClient,
  visitId: string,
): Promise<DoctorNoteMetadata[]> {
  const notes = await prisma.doctorNote.findMany({
    where: { visitId },
    orderBy: { createdAt: 'asc' },
  });
  return notes.map(mapNoteToMetadata);
}

export async function getDoctorNotesForVisits(
  prisma: PrismaClient,
  visitIds: string[],
): Promise<Map<string, DoctorNoteMetadata[]>> {
  if (visitIds.length === 0) {
    return new Map();
  }

  const notes = await prisma.doctorNote.findMany({
    where: { visitId: { in: visitIds } },
    orderBy: { createdAt: 'asc' },
  });

  const grouped = new Map<string, DoctorNoteMetadata[]>();
  for (const note of notes) {
    const meta = mapNoteToMetadata(note);
    const existing = grouped.get(meta.visitId);
    if (existing) {
      existing.push(meta);
    } else {
      grouped.set(meta.visitId, [meta]);
    }
  }
  return grouped;
}

export async function getDoctorNoteById(
  prisma: PrismaClient,
  id: string,
): Promise<DoctorNoteMetadata | null> {
  const note = await prisma.doctorNote.findUnique({ where: { id } });
  return note ? mapNoteToMetadata(note) : null;
}

export async function loadDoctorNoteContent(note: DoctorNoteMetadata): Promise<DoctorNoteContent | null> {
  if (note.storageType === DoctorNoteStorageType.S3) {
    return loadFromS3(note);
  }
  if (note.storageType === DoctorNoteStorageType.MONGO) {
    return loadFromMongo(note);
  }
  if (note.storageType === DoctorNoteStorageType.LOCAL) {
    return loadFromLocal(note);
  }
  return null;
}

type DoctorNoteWithExtraction = DoctorNote & { extractedText?: string | null };

function mapNoteToMetadata(note: DoctorNote): DoctorNoteMetadata {
  const noteWithExtraction = note as DoctorNoteWithExtraction;

  return {
    id: note.id,
    visitId: note.visitId,
    tenantId: note.tenantId,
    patientId: note.patientId,
    storageType: note.storageType,
    storageKey: note.storageKey,
    fileName: note.fileName ?? null,
    contentType: note.contentType ?? null,
    size: note.size,
    createdAt: note.createdAt,
    extractedText: noteWithExtraction.extractedText ?? null,
  };
}

async function loadFromS3(note: DoctorNoteMetadata): Promise<DoctorNoteContent | null> {
  const bucket = process.env.DOCTOR_NOTES_S3_BUCKET ?? process.env.AWS_S3_BUCKET ?? process.env.S3_BUCKET;
  if (!bucket) {
    return null;
  }

  const config = getS3Config();
  if (!config) {
    return null;
  }

  try {
    const response = await fetchS3Object({
      ...config,
      bucket,
      key: note.storageKey,
    });

    if (!response) {
      return null;
    }

    const { stream, contentLength, contentType } = response;
    return {
      stream,
      size: contentLength ?? note.size,
      contentType: contentType ?? note.contentType ?? inferMimeType(note.fileName) ?? 'application/octet-stream',
      fileName: note.fileName,
      source: DoctorNoteStorageType.S3,
    };
  } catch (error) {
    console.warn('Failed to load doctor note from S3', { key: note.storageKey, error });
    return null;
  }
}

type FetchS3Params = S3Config & {
  bucket: string;
  key: string;
};

type FetchS3Result = {
  stream: Readable;
  contentLength?: number;
  contentType?: string;
};

async function fetchS3Object(params: FetchS3Params): Promise<FetchS3Result | null> {
  const { region, accessKeyId, secretAccessKey, sessionToken, endpoint, bucket, key } = params;
  const url = buildS3Url({ region, bucket, key, endpoint });

  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalHeaders = [
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ];
  const signedHeaderNames = ['host', 'x-amz-content-sha256', 'x-amz-date'];
  if (sessionToken) {
    canonicalHeaders.push(`x-amz-security-token:${sessionToken}`);
    signedHeaderNames.push('x-amz-security-token');
  }

  const canonicalRequest = [
    'GET',
    url.pathname || '/',
    url.searchParams.toString(),
    `${canonicalHeaders.join('\n')}\n`,
    signedHeaderNames.join(';'),
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, 's3');
  const signature = hmacHex(signingKey, stringToSign);

  const headers: Record<string, string> = {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames.join(';')}, Signature=${signature}`,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    host: url.host,
  };

  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }

  const requestOptions: RequestOptions = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    method: 'GET',
    path: `${url.pathname}${url.search}`,
    headers,
  };

  return new Promise<FetchS3Result | null>((resolve, reject) => {
    const request = https.request(requestOptions, (response) => {
      if (!response.statusCode) {
        response.resume();
        reject(new Error('S3 response missing status code'));
        return;
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        const contentLengthHeader = response.headers['content-length'];
        const contentTypeHeader = response.headers['content-type'];
        const contentLength = Array.isArray(contentLengthHeader)
          ? Number(contentLengthHeader[0])
          : contentLengthHeader
            ? Number(contentLengthHeader)
            : undefined;
        const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;

        resolve({
          stream: response,
          contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
          contentType: contentType ?? undefined,
        });
        return;
      }

      if (response.statusCode === 404) {
        response.resume();
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => {
        if (chunks.length < 4) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      });
      response.on('error', (error) => {
        reject(error);
      });
      response.on('end', () => {
        const bodySnippet = Buffer.concat(chunks).toString('utf8');
        reject(new Error(`S3 request failed with status ${response.statusCode}: ${bodySnippet}`));
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });
}

type BuildS3UrlParams = {
  region: string;
  bucket: string;
  key: string;
  endpoint?: string;
};

type EncodedKey = {
  segments: string[];
  trailingSlashCount: number;
};

function buildS3Url({ region, bucket, key, endpoint }: BuildS3UrlParams): URL {
  const { segments, trailingSlashCount } = encodeS3Key(key);

  if (endpoint) {
    const resolvedEndpoint = endpoint.includes('://') ? endpoint : `https://${endpoint}`;
    if (resolvedEndpoint.includes('{bucket}')) {
      const replaced = resolvedEndpoint.replace('{bucket}', bucket);
      const baseUrl = new URL(replaced);
      const baseSegments = baseUrl.pathname.split('/').filter((segment) => segment.length > 0);
      const pathSegments = [...baseSegments, ...segments];
      baseUrl.pathname = formatPath(pathSegments, trailingSlashCount);
      baseUrl.search = '';
      baseUrl.hash = '';
      return baseUrl;
    }

    const baseUrl = new URL(resolvedEndpoint);
    const baseSegments = baseUrl.pathname.split('/').filter((segment) => segment.length > 0);
    const pathSegments = [...baseSegments, bucket, ...segments];
    baseUrl.pathname = formatPath(pathSegments, trailingSlashCount);
    baseUrl.search = '';
    baseUrl.hash = '';
    return baseUrl;
  }

  const baseUrl = new URL(`https://${bucket}.s3.${region}.amazonaws.com/`);
  baseUrl.pathname = formatPath(segments, trailingSlashCount);
  return baseUrl;
}

function formatPath(segments: string[], trailingSlashCount: number): string {
  let path = segments.length === 0 ? '/' : `/${segments.join('/')}`;

  if (trailingSlashCount > 0) {
    const extraSlashes = segments.length === 0 ? Math.max(trailingSlashCount - 1, 0) : trailingSlashCount;
    if (extraSlashes > 0) {
      path += '/'.repeat(extraSlashes);
    }
  }

  return path;
}

function encodeS3Key(key: string): EncodedKey {
  if (key === '') {
    return { segments: [], trailingSlashCount: 0 };
  }

  const trailingSlashMatch = key.match(/\/+$/);
  const trailingSlashCount = trailingSlashMatch ? trailingSlashMatch[0].length : 0;
  const basePart = trailingSlashCount > 0 ? key.slice(0, -trailingSlashCount) : key;
  const rawSegments = basePart.length > 0 ? basePart.split('/') : [];
  const segments = rawSegments.map((segment) => encodeURIComponent(segment));

  return { segments, trailingSlashCount };
}

function toAmzDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const hours = `${date.getUTCHours()}`.padStart(2, '0');
  const minutes = `${date.getUTCMinutes()}`.padStart(2, '0');
  const seconds = `${date.getUTCSeconds()}`.padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(bufferKey: Buffer | string, value: string): Buffer {
  return crypto.createHmac('sha256', bufferKey).update(value, 'utf8').digest();
}

function hmacHex(bufferKey: Buffer | string, value: string): string {
  return hmac(bufferKey, value).toString('hex');
}

function getSignatureKey(secretAccessKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function loadFromMongo(note: DoctorNoteMetadata): Promise<DoctorNoteContent | null> {
  try {
    const collection = await getMongoCollection<MongoDoctorNoteDocument>('doctorNotes');
    const objectId = new ObjectId(note.storageKey);
    const document = await collection.findOne({ _id: objectId });
    if (!document) {
      return null;
    }
    const buffer = document.data.buffer as Buffer;
    const stream = Readable.from(buffer);
    const contentType = document.contentType ?? note.contentType ?? inferMimeType(document.filename) ?? 'application/octet-stream';
    return {
      stream,
      size: document.size,
      contentType,
      fileName: document.filename ?? note.fileName,
      source: DoctorNoteStorageType.MONGO,
    };
  } catch (error) {
    console.warn('Failed to load doctor note from MongoDB', { key: note.storageKey, error });
    return null;
  }
}

async function loadFromLocal(note: DoctorNoteMetadata): Promise<DoctorNoteContent | null> {
  const baseDir = process.env.DOCTOR_NOTES_DIR ?? path.resolve(process.cwd(), 'storage/doctor-notes');
  const filePath = path.resolve(baseDir, note.storageKey);
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    const stat = await fs.promises.stat(filePath);
    const stream = fs.createReadStream(filePath);
    const contentType = note.contentType ?? inferMimeType(note.fileName) ?? 'application/octet-stream';
    return {
      stream,
      size: stat.size,
      contentType,
      fileName: note.fileName,
      source: DoctorNoteStorageType.LOCAL,
    };
  } catch (error) {
    console.warn('Failed to load doctor note from local storage', { filePath, error });
    return null;
  }
}

function inferMimeType(fileName: string | null | undefined): string | null {
  if (!fileName) {
    return null;
  }
  const mime = lookupMime(fileName);
  return typeof mime === 'string' ? mime : null;
}
