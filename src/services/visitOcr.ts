import OpenAI from 'openai';
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface VisitOcrObservation {
  noteText?: string | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  heartRate?: number | null;
  temperatureC?: number | null;
  spo2?: number | null;
  bmi?: number | null;
}

export interface VisitOcrMedication {
  drugName: string;
  dosage?: string | null;
}

export interface VisitOcrLabResult {
  testName: string;
  resultValue?: number | null;
  unit?: string | null;
}

export interface VisitOcrExtraction {
  observation: VisitOcrObservation | null;
  diagnoses: string[];
  medications: VisitOcrMedication[];
  labResults: VisitOcrLabResult[];
  warnings: string[];
  rawText: string | null;
}

export class VisitOcrError extends Error {
  statusCode?: number;
  constructor(message: string, options?: { statusCode?: number; cause?: unknown }) {
    super(message);
    this.name = 'VisitOcrError';
    this.statusCode = options?.statusCode;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

const DEFAULT_MODEL = process.env.VISIT_OCR_MODEL || 'gpt-4o-mini';
let cachedClient: OpenAI | null = null;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new VisitOcrError('OpenAI API key is not configured. Set OPENAI_API_KEY to enable observation OCR.', {
      statusCode: 503,
    });
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

function buildSchema() {
  return {
    name: 'visit_observation_extraction',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['diagnoses', 'medications', 'labResults', 'warnings', 'rawText'],
      properties: {
        rawText: { type: 'string', nullable: true },
        warnings: {
          type: 'array',
          items: { type: 'string' },
          default: [],
        },
        observation: {
          type: 'object',
          nullable: true,
          additionalProperties: false,
          properties: {
            noteText: { type: 'string', nullable: true },
            bpSystolic: { type: 'number', nullable: true },
            bpDiastolic: { type: 'number', nullable: true },
            heartRate: { type: 'number', nullable: true },
            temperatureC: { type: 'number', nullable: true },
            spo2: { type: 'number', nullable: true },
            bmi: { type: 'number', nullable: true },
          },
        },
        diagnoses: {
          type: 'array',
          items: { type: 'string' },
          default: [],
        },
        medications: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['drugName'],
            properties: {
              drugName: { type: 'string' },
              dosage: { type: 'string', nullable: true },
            },
          },
          default: [],
        },
        labResults: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['testName'],
            properties: {
              testName: { type: 'string' },
              resultValue: { type: 'number', nullable: true },
              unit: { type: 'string', nullable: true },
            },
          },
          default: [],
        },
      },
    },
  } as const;
}

function ensureJsonObject(content: string) {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new VisitOcrError('Unable to parse OCR response from OpenAI.', { statusCode: 502 });
  }
  const jsonSlice = content.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonSlice) as Record<string, unknown>;
  } catch (error) {
    throw new VisitOcrError('Observation OCR returned invalid JSON data.', {
      statusCode: 502,
      cause: error,
    });
  }
}

function normalizeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeObservation(record: unknown): VisitOcrObservation | null {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const data = record as Record<string, unknown>;
  const noteText = normalizeString(data.noteText);
  const bpSystolic = normalizeNumber(data.bpSystolic);
  const bpDiastolic = normalizeNumber(data.bpDiastolic);
  const heartRate = normalizeNumber(data.heartRate);
  const temperatureC = normalizeNumber(data.temperatureC);
  const spo2 = normalizeNumber(data.spo2);
  const bmi = normalizeNumber(data.bmi);

  if (
    noteText === null &&
    bpSystolic === null &&
    bpDiastolic === null &&
    heartRate === null &&
    temperatureC === null &&
    spo2 === null &&
    bmi === null
  ) {
    return null;
  }

  return {
    ...(noteText !== null ? { noteText } : {}),
    ...(bpSystolic !== null ? { bpSystolic } : {}),
    ...(bpDiastolic !== null ? { bpDiastolic } : {}),
    ...(heartRate !== null ? { heartRate } : {}),
    ...(temperatureC !== null ? { temperatureC } : {}),
    ...(spo2 !== null ? { spo2 } : {}),
    ...(bmi !== null ? { bmi } : {}),
  };
}

function normalizeDiagnoses(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => entry !== null);
}

function normalizeMedications(value: unknown): VisitOcrMedication[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const drugName = normalizeString(record.drugName);
      if (!drugName) return null;
      const dosage = normalizeString(record.dosage);
      return { drugName, ...(dosage ? { dosage } : {}) };
    })
    .filter((item): item is VisitOcrMedication => item !== null);
}

function normalizeLabResults(value: unknown): VisitOcrLabResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const testName = normalizeString(record.testName);
      if (!testName) return null;
      const resultValue = normalizeNumber(record.resultValue);
      const unit = normalizeString(record.unit);
      return {
        testName,
        ...(resultValue !== null ? { resultValue } : {}),
        ...(unit ? { unit } : {}),
      };
    })
    .filter((item): item is VisitOcrLabResult => item !== null);
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => entry !== null);
}

export async function extractVisitDetailsFromImage(buffer: Buffer, mimeType?: string | null): Promise<VisitOcrExtraction> {
  if (!buffer || buffer.length === 0) {
    throw new VisitOcrError('Uploaded image is empty. Please try another file.', { statusCode: 400 });
  }

  const client = getClient();
  const model = DEFAULT_MODEL;
  const base64 = buffer.toString('base64');
  const imageUrl = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;

  const userContent: ChatCompletionContentPart[] = [
    {
      type: 'text',
      text:
        'Read this clinical observation note image. ' +
        'Extract the doctor\'s narrative comment, vital signs, diagnoses, medications, and any laboratory values. ' +
        'Return concise text without additional commentary.',
    },
    {
      type: 'image_url',
      image_url: { url: imageUrl },
    },
  ];

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You are a medical documentation assistant that extracts structured visit details from physician notes. ' +
        'Use ISO 8601 dates when needed and prefer metric units. ' +
        'If a value is missing, use null rather than guessing.',
    },
    {
      role: 'user',
      content: userContent,
    },
  ];

  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_schema', json_schema: buildSchema() },
    messages,
  });

  const message = response.choices?.[0]?.message;
  if (!message) {
    throw new VisitOcrError('OpenAI returned an empty response for the observation.', { statusCode: 502 });
  }

  const structuredMessage = message as typeof message & { parsed?: unknown };

  let parsed: Record<string, unknown>;
  if (structuredMessage.parsed && typeof structuredMessage.parsed === 'object') {
    parsed = structuredMessage.parsed as Record<string, unknown>;
  } else {
    const content = structuredMessage.content;
    if (!content) {
      throw new VisitOcrError('OpenAI returned an empty response for the observation.', { statusCode: 502 });
    }
    const textContent = Array.isArray(content)
      ? content.map((part) => ('text' in part ? part.text : typeof part === 'string' ? part : '')).join('')
      : content;
    parsed = ensureJsonObject(textContent);
  }

  const observation = normalizeObservation(parsed.observation);
  const diagnoses = normalizeDiagnoses(parsed.diagnoses);
  const medications = normalizeMedications(parsed.medications);
  const labResults = normalizeLabResults(parsed.labResults);
  const warnings = normalizeWarnings(parsed.warnings);
  const rawText = normalizeString(parsed.rawText);

  return {
    observation,
    diagnoses,
    medications,
    labResults,
    warnings,
    rawText,
  };
}
