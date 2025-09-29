import request from 'supertest';

jest.mock('@prisma/client', () => {
  const mPrisma = {
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    session: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    authAudit: { create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    patient: { findUnique: jest.fn() },
  };
  return { PrismaClient: jest.fn(() => mPrisma), Prisma: { sql: () => '' } };
});

describe('security headers and rate limits', () => {
  let app: any;

  beforeEach(async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_MAX = '2';
    process.env.RATE_LIMIT_WINDOW_MIN = '1';
    const mod = await import('../src/index');
    app = mod.app;
  });

  it('disables x-powered-by and sets helmet headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rate limits patient search', async () => {
    await request(app).get('/api/patients').query({ query: 'a' });
    await request(app).get('/api/patients').query({ query: 'a' });
    const res = await request(app)
      .get('/api/patients')
      .query({ query: 'a' });
    expect(res.status).toBe(429);
  });
});

describe('CORS in production', () => {
  it('disables cors in production', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    const mod = await import('../src/index');
    const res = await request(mod.app).get('/api/health');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
