import { Binary, ObjectId } from 'mongodb';
import { getMongoCollection } from './mongoClient.js';
import type { VisitOcrExtraction } from './visitOcr.js';

export interface ObservationImageDocument {
  _id: ObjectId;
  tenantId: string;
  visitId: string;
  patientId: string;
  doctorId: string;
  uploadedBy: string;
  filename: string | null;
  contentType: string | null;
  size: number;
  data: Binary;
  createdAt: Date;
  ocr: VisitOcrExtraction | null;
  ocrError: string | null;
}

export interface SaveObservationImageParams {
  tenantId: string;
  visitId: string;
  patientId: string;
  doctorId: string;
  uploadedBy: string;
  filename: string | null;
  contentType: string | null;
  size: number;
  buffer: Buffer;
  ocr: VisitOcrExtraction | null;
  ocrError: string | null;
}

export interface SaveObservationImageResult {
  imageId: string;
  createdAt: Date;
}

const COLLECTION_NAME = 'visitObservationImages';

export async function saveObservationImage(
  params: SaveObservationImageParams,
): Promise<SaveObservationImageResult> {
  const collection = await getMongoCollection<ObservationImageDocument>(COLLECTION_NAME);
  const createdAt = new Date();
  const document: Omit<ObservationImageDocument, '_id'> = {
    tenantId: params.tenantId,
    visitId: params.visitId,
    patientId: params.patientId,
    doctorId: params.doctorId,
    uploadedBy: params.uploadedBy,
    filename: params.filename,
    contentType: params.contentType,
    size: params.size,
    data: new Binary(params.buffer),
    createdAt,
    ocr: params.ocr,
    ocrError: params.ocrError,
  };

  const result = await collection.insertOne(document as ObservationImageDocument);

  return {
    imageId: result.insertedId.toHexString(),
    createdAt,
  };
}
