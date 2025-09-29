import { jest } from '@jest/globals';

jest.mock('openai', () => {
  const completionsCreate = jest.fn();
  const mockClient = { chat: { completions: { create: completionsCreate } } };
  const MockOpenAI = jest.fn(() => mockClient);

  class MockAPIError extends Error {
    status?: number;
    error?: { message?: string };

    constructor(message?: string, status?: number, error?: { message?: string }) {
      super(message);
      this.status = status;
      this.error = error;
    }
  }

  return {
    __esModule: true,
    default: MockOpenAI,
    APIError: MockAPIError,
    __mockOpenAI: { completionsCreate, mockClient, MockOpenAI },
  };
});

describe('scanInvoice', () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterAll(() => {
    delete process.env.OPENAI_API_KEY;
  });

  beforeEach(() => {
    const openaiModule = jest.requireMock('openai') as unknown as {
      __mockOpenAI: { completionsCreate: jest.Mock };
    };
    openaiModule.__mockOpenAI.completionsCreate.mockReset();
  });

  it('surfaces a helpful error when the OpenAI client is unauthorized', async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const openaiModule = jest.requireMock('openai') as unknown as {
      __mockOpenAI: { completionsCreate: jest.Mock };
    };
    openaiModule.__mockOpenAI.completionsCreate.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), {
        status: 401,
        error: { message: 'Incorrect API key provided' },
      }) as never,
    );

    const { scanInvoice, InvoiceScanError } = await import('../../src/services/invoiceScanner');

    const scanPromise = scanInvoice(buffer, 'image/gif');

    const error = await scanPromise.then<unknown>(() => {
      throw new Error('Expected scanInvoice to reject for unauthorized responses.');
    }).catch((err) => err);

    expect(error).toBeInstanceOf(InvoiceScanError);
    const invoiceError = error as InstanceType<typeof InvoiceScanError>;
    expect(invoiceError.statusCode).toBe(503);
    expect(invoiceError.message).toContain('not authorized');
    expect(invoiceError.details).toEqual({
      providerMessage: 'Incorrect API key provided',
    });
  });
});
