import OpenAI from 'openai';
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface InvoiceScanLineItem {
  brandName?: string | null;
  genericName?: string | null;
  form?: string | null;
  strength?: string | null;
  packageDescription?: string | null;
  quantity?: number | null;
  unitCost?: number | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  suggestedLocation?: string | null;
}

export interface InvoiceScanMetadata {
  vendor?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  total?: number | null;
  destination?: string | null;
}

export interface InvoiceScanResult {
  metadata: InvoiceScanMetadata;
  lineItems: InvoiceScanLineItem[];
  warnings: string[];
  rawText?: string | null;
}

export class InvoiceScanError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(message: string, options?: { statusCode?: number; cause?: unknown; details?: unknown }) {
    super(message);
    this.name = 'InvoiceScanError';
    this.statusCode = options?.statusCode;
    this.details = options?.details;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_PDF_TEXT_LENGTH = 20_000;
let cachedClient: OpenAI | null = null;

async function extractPdfText(buffer: Buffer) {
  const pdfModule = await import('pdf-parse');
  const parser = (pdfModule.default ?? pdfModule) as unknown;
  if (typeof parser !== 'function') {
    throw new InvoiceScanError('Invoice PDF support is not available. Please enter details manually.', {
      statusCode: 501,
    });
  }
  const result = await (parser as (data: Buffer) => Promise<{ text?: string | null }>)(buffer);
  return result.text ?? '';
}

function sanitizePdfText(raw: string) {
  const cleaned = raw.replace(/\u0000/g, ' ').replace(/\r/g, '');
  const trimmed = cleaned.trim();
  if (trimmed.length <= MAX_PDF_TEXT_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_PDF_TEXT_LENGTH)}\n... (truncated)`;
}

function isPdf(buffer: Buffer, mimeType?: string | null) {
  if (mimeType && mimeType.toLowerCase().includes('pdf')) {
    return true;
  }
  if (buffer.length >= 4) {
    const signature = buffer.subarray(0, 4).toString('ascii');
    if (signature === '%PDF') {
      return true;
    }
  }
  return false;
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new InvoiceScanError('OpenAI API key is not configured. Set OPENAI_API_KEY to enable invoice scanning.', {
      statusCode: 503,
    });
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

function ensureJsonObject(content: string, debugContext?: Record<string, unknown>) {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new InvoiceScanError('Unable to parse invoice response from OpenAI.', {
      statusCode: 502,
      details: {
        ...(debugContext ? { debugContext } : {}),
        reason: 'missing_json_braces',
        contentLength: content.length,
      },
    });
  }
  const jsonSlice = content.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonSlice);
  } catch (error) {
    throw new InvoiceScanError('Invoice parsing returned invalid JSON data.', {
      statusCode: 502,
      cause: error,
      details: {
        ...(debugContext ? { debugContext } : {}),
        reason: 'invalid_json_payload',
        contentLength: jsonSlice.length,
      },
    });
  }
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function buildSchema() {
  return {
    name: 'pharmacy_invoice_extraction',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['lineItems'],
      properties: {
        rawText: { type: 'string', description: 'Full transcription of the invoice if helpful', nullable: true },
        warnings: {
          type: 'array',
          description: 'Any issues or ambiguities detected while reading the invoice.',
          items: { type: 'string' },
        },
        metadata: {
          type: 'object',
          additionalProperties: false,
          properties: {
            vendor: { type: 'string', nullable: true },
            invoiceNumber: { type: 'string', nullable: true },
            invoiceDate: {
              type: 'string',
              nullable: true,
              description: 'ISO 8601 date (YYYY-MM-DD) for the invoice',
            },
            currency: { type: 'string', nullable: true },
            subtotal: { type: 'number', nullable: true },
            total: { type: 'number', nullable: true },
            destination: {
              type: 'string',
              nullable: true,
              description: 'Receiving location or department if present on the invoice',
            },
          },
          required: [],
        },
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              brandName: { type: 'string', nullable: true },
              genericName: { type: 'string', nullable: true },
              form: { type: 'string', nullable: true },
              strength: { type: 'string', nullable: true },
              packageDescription: { type: 'string', nullable: true },
              quantity: { type: 'number', nullable: true },
              unitCost: { type: 'number', nullable: true },
              batchNumber: { type: 'string', nullable: true },
              expiryDate: {
                type: 'string',
                nullable: true,
                description: 'ISO 8601 date (YYYY-MM-DD) representing the expiration date',
              },
              notes: { type: 'string', nullable: true },
              suggestedLocation: {
                type: 'string',
                nullable: true,
                description: 'Storage or destination hinted at by the invoice line if provided',
              },
            },
            required: [],
          },
        },
      },
    },
    strict: true,
  } as const;
}

function isSupportedImage(buffer: Buffer, mimeType?: string | null) {
  if (mimeType && mimeType.toLowerCase().startsWith('image/')) {
    return true;
  }

  if (buffer.length >= 4) {
    const signature = buffer.subarray(0, 4);
    // PNG
    if (signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
      return true;
    }
    // JPEG (0xFFD8FF)
    if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
      return true;
    }
    // GIF87a / GIF89a both start with GIF8
    if (signature.equals(Buffer.from('GIF8', 'ascii'))) {
      return true;
    }
    // WEBP starts with RIFF....WEBP
    if (buffer.length >= 12) {
      const riffHeader = buffer.subarray(0, 4).toString('ascii');
      const webpHeader = buffer.subarray(8, 12).toString('ascii');
      if (riffHeader === 'RIFF' && webpHeader === 'WEBP') {
        return true;
      }
    }
  }

  return false;
}

export async function scanInvoice(buffer: Buffer, mimeType?: string | null): Promise<InvoiceScanResult> {
  const model = process.env.OPENAI_INVOICE_MODEL || DEFAULT_MODEL;
  const debugContext: Record<string, unknown> = {
    model,
    mimeType: mimeType ?? null,
    fileSize: buffer.length,
  };
  if (!buffer.length) {
    throw new InvoiceScanError('Invoice file is empty.', {
      statusCode: 400,
      details: { debugContext, reason: 'empty_file' },
    });
  }

  const client = getClient();
  try {
    const pdf = isPdf(buffer, mimeType);

    let userContent: string | ChatCompletionContentPart[];

    if (pdf) {
      const rawText = await extractPdfText(buffer);
      debugContext.inputType = 'pdf';
      debugContext.pdfRawTextLength = rawText.length;
      const sanitizedText = sanitizePdfText(rawText);
      debugContext.pdfSanitizedLength = sanitizedText.length;
      debugContext.pdfTruncated = sanitizedText.includes('... (truncated)');
      if (!sanitizedText) {
        throw new InvoiceScanError('No readable text was found in the invoice PDF. Please enter details manually.', {
          statusCode: 422,
          details: { debugContext, reason: 'empty_pdf_text' },
        });
      }
      userContent =
        'Read this invoice and summarize each medication line. ' +
        'Please keep numbers as digits and use ISO 8601 dates (YYYY-MM-DD).\n\n' +
        `Invoice text:\n${sanitizedText}`;
    } else {
      debugContext.inputType = 'image';
      if (!isSupportedImage(buffer, mimeType)) {
        throw new InvoiceScanError('Unsupported invoice format. Upload a PDF or image file instead.', {
          statusCode: 415,
          details: { debugContext, reason: 'unsupported_mime_type' },
        });
      }
      const base64 = buffer.toString('base64');
      const imageUrl = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;
      userContent = [
        {
          type: 'text',
          text:
            'Read this invoice and summarize each medication line. ' +
            'Please keep numbers as digits and use ISO 8601 dates (YYYY-MM-DD).',
        },
        {
          type: 'image_url',
          image_url: {
            url: imageUrl,
          },
        },
      ];
    }

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are an assistant that extracts structured pharmacy inventory data from supplier invoices. ' +
          'Return JSON that matches the provided schema. ' +
          'Capture medication names, strengths, forms, quantities, batch or lot numbers, expiration dates, and unit costs when available. ' +
          'If values are not provided, use null.',
      },
      {
        role: 'user',
        content: userContent,
      },
    ];

    debugContext.messages = messages.length;

    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: buildSchema() },
      messages,
    });

    debugContext.openAIResponseId = response.id;
    debugContext.openAIModel = response.model;
    debugContext.openAIFinishReason = response.choices?.[0]?.finish_reason ?? null;
    debugContext.openAIUsage = response.usage ?? null;

    const message = response.choices?.[0]?.message;
    if (!message) {
      throw new InvoiceScanError('OpenAI returned an empty response for the invoice.', {
        statusCode: 502,
        details: { debugContext, reason: 'missing_message' },
      });
    }

    const structuredMessage = message as typeof message & { parsed?: unknown };

    let parsed: unknown;

    if (structuredMessage.parsed) {
      parsed = structuredMessage.parsed;
    } else {
      const content = structuredMessage.content;
      if (!content) {
        throw new InvoiceScanError('OpenAI returned an empty response for the invoice.', {
          statusCode: 502,
          details: { debugContext, reason: 'missing_content' },
        });
      }

      const textContent = Array.isArray(content)
        ? content
            .map((part) => ('text' in part ? part.text : typeof part === 'string' ? part : ''))
            .join('')
        : content;

      parsed = ensureJsonObject(textContent, debugContext);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new InvoiceScanError('OpenAI returned an invalid invoice response.', {
        statusCode: 502,
        details: { debugContext, reason: 'non_object_response' },
      });
    }

    const parsedRecord = parsed as Record<string, unknown>;

    const rawWarnings = Array.isArray(parsedRecord.warnings)
      ? (parsedRecord.warnings as unknown[])
      : [];
    const metadata = (parsedRecord.metadata ?? {}) as Record<string, unknown>;
    const normalizedMetadata: InvoiceScanMetadata = {
      vendor: normalizeString(metadata.vendor),
      invoiceNumber: normalizeString(metadata.invoiceNumber),
      invoiceDate: normalizeDate(metadata.invoiceDate),
      currency: normalizeString(metadata.currency),
      subtotal: normalizeNumber(metadata.subtotal),
      total: normalizeNumber(metadata.total),
      destination: normalizeString(metadata.destination),
    };

    const lineItemsSource = Array.isArray(parsedRecord.lineItems)
      ? (parsedRecord.lineItems as Record<string, unknown>[])
      : [];
    const lineItems: InvoiceScanLineItem[] = lineItemsSource.map((item: Record<string, unknown>) => ({
      brandName: normalizeString(item.brandName),
      genericName: normalizeString(item.genericName),
      form: normalizeString(item.form),
      strength: normalizeString(item.strength),
      packageDescription: normalizeString(item.packageDescription),
      quantity: normalizeNumber(item.quantity),
      unitCost: normalizeNumber(item.unitCost),
      batchNumber: normalizeString(item.batchNumber),
      expiryDate: normalizeDate(item.expiryDate),
      notes: normalizeString(item.notes),
      suggestedLocation: normalizeString(item.suggestedLocation),
    }));

    console.info('Invoice scan succeeded', {
      debugContext,
      metadata: normalizedMetadata,
      lineItemCount: lineItems.length,
      warningCount: rawWarnings.length,
    });

    return {
      metadata: normalizedMetadata,
      lineItems,
      warnings: rawWarnings.map((warning: unknown) => normalizeString(warning) || 'Unspecified issue detected during parsing.'),
      rawText: normalizeString(parsedRecord.rawText),
    };
  } catch (error) {
    const serializedError =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: 'UnknownError', message: String(error) };
    console.error('Invoice scan failed', { error: serializedError, debugContext });
    if (error instanceof InvoiceScanError) {
      const existingDetails =
        error.details && typeof error.details === 'object'
          ? (error.details as Record<string, unknown>)
          : {};
      error.details = { ...existingDetails, debugContext };
      throw error;
    }

    const status =
      typeof error === 'object' && error !== null
        ? (error as { status?: number; statusCode?: number }).status ??
          (error as { status?: number; statusCode?: number }).statusCode ??
          null
        : null;

    if (status === 401 || status === 403) {
      const providerMessage =
        typeof error === 'object' && error !== null
          ? (error as { error?: { message?: string } }).error?.message ??
            (typeof (error as { message?: unknown }).message === 'string'
              ? (error as { message?: string }).message
              : undefined)
          : undefined;

      throw new InvoiceScanError(
        'Invoice scanning is not authorized. Verify the OpenAI API credentials and try again.',
        {
          statusCode: 503,
          cause: error,
          details: providerMessage
            ? { providerMessage, debugContext }
            : { debugContext, reason: 'unauthorized' },
        },
      );
    }

    throw new InvoiceScanError('Unable to analyze the invoice automatically. Please enter details manually.', {
      statusCode: 502,
      cause: error,
      details: { debugContext },
    });
  }
}
