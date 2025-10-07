import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../src/index';

const prisma = new PrismaClient();

function makeAuthHeader(userId: string, role: string, email: string, tenantId?: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, role, email, ...(tenantId ? { tenantId } : {}) }),
  ).toString('base64url');
  return `Bearer ${header}.${payload}.`;
}

describe('Clinic configuration permissions', () => {
  let tenantId: string;
  let systemAdminId: string;
  let assignedItAdminId: string;
  let unassignedItAdminId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: { name: 'Configurable Clinic', code: `clinic-${Date.now()}` },
    });
    tenantId = tenant.tenantId;

    const systemAdmin = await prisma.user.create({
      data: {
        email: `sysadmin-${Date.now()}@example.com`,
        passwordHash: 'x',
        role: 'SystemAdmin',
        status: 'active',
      },
    });
    systemAdminId = systemAdmin.userId;

    const assignedItAdmin = await prisma.user.create({
      data: {
        email: `itadmin-${Date.now()}@example.com`,
        passwordHash: 'x',
        role: 'ITAdmin',
        status: 'active',
      },
    });
    assignedItAdminId = assignedItAdmin.userId;

    await prisma.userTenant.create({
      data: {
        tenantId,
        userId: assignedItAdminId,
        role: 'ITAdmin',
      },
    });

    const unassignedItAdmin = await prisma.user.create({
      data: {
        email: `itadmin-unassigned-${Date.now()}@example.com`,
        passwordHash: 'x',
        role: 'ITAdmin',
        status: 'active',
      },
    });
    unassignedItAdminId = unassignedItAdmin.userId;
  });

  afterAll(async () => {
    await prisma.tenantConfiguration.deleteMany({ where: { tenantId } });
    await prisma.userTenant.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({
      where: { userId: { in: [systemAdminId, assignedItAdminId, unassignedItAdminId] } },
    });
    await prisma.tenant.deleteMany({ where: { tenantId } });
    await prisma.$disconnect();
  });

  it('allows a system administrator to read and update clinic configuration', async () => {
    const authHeader = makeAuthHeader(
      systemAdminId,
      'SystemAdmin',
      'sysadmin@example.com',
      tenantId,
    );

    const initialRes = await request(app)
      .get('/api/settings/clinic')
      .set('Authorization', authHeader);

    expect(initialRes.status).toBe(200);
    expect(initialRes.body.appName).toBeDefined();
    expect(initialRes.body.widgetEnabled).toBe(false);

    const updateRes = await request(app)
      .patch('/api/settings/clinic')
      .set('Authorization', authHeader)
      .send({
        appName: 'Downtown Family Clinic',
        widgetEnabled: true,
        contactAddress: '123 Main Street, Yangon',
        contactPhone: '+95 1 234 567',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.appName).toBe('Downtown Family Clinic');
    expect(updateRes.body.widgetEnabled).toBe(true);
    expect(updateRes.body.contactAddress).toBe('123 Main Street, Yangon');
    expect(updateRes.body.contactPhone).toBe('+95 1 234 567');

    const stored = await prisma.tenantConfiguration.findUnique({ where: { tenantId } });
    expect(stored?.appName).toBe('Downtown Family Clinic');
    expect(stored?.widgetEnabled).toBe(true);
    expect(stored?.contactAddress).toBe('123 Main Street, Yangon');
    expect(stored?.contactPhone).toBe('+95 1 234 567');
  });

  it('allows assigned IT administrators to update clinic configuration', async () => {
    const authHeader = makeAuthHeader(
      assignedItAdminId,
      'ITAdmin',
      'itadmin@example.com',
      tenantId,
    );

    const res = await request(app)
      .patch('/api/settings/clinic')
      .set('Authorization', authHeader)
      .send({
        appName: 'Neighborhood Clinic',
        widgetEnabled: true,
        contactAddress: null,
        contactPhone: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.appName).toBe('Neighborhood Clinic');
    expect(res.body.widgetEnabled).toBe(true);
    expect(res.body.contactAddress).toBeNull();
    expect(res.body.contactPhone).toBeNull();
  });

  it('prevents unassigned IT administrators from updating clinic configuration', async () => {
    const authHeader = makeAuthHeader(
      unassignedItAdminId,
      'ITAdmin',
      'unassigned@example.com',
      tenantId,
    );

    const res = await request(app)
      .patch('/api/settings/clinic')
      .set('Authorization', authHeader)
      .send({ appName: 'Unauthorized Update' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });
});
