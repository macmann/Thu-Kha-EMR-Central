import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../src/index';

const prisma = new PrismaClient();

function makeAuthHeader(userId: string, role: string, email: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId, role, email })).toString('base64url');
  return `Bearer ${header}.${payload}.`;
}

let doctorUserId: string;
let nurseUserId: string;
let labTechUserId: string;
let visitId: string;
let patientId: string;
let labOrderId: string;
let labOrderItemIds: string[] = [];

beforeAll(async () => {
  const doctor = await prisma.doctor.create({ data: { name: 'Dr Clinical', department: 'Internal Medicine' } });
  const patient = await prisma.patient.create({
    data: { name: 'Test Patient', dob: new Date('1990-01-01'), gender: 'F' },
  });
  patientId = patient.patientId;
  const visit = await prisma.visit.create({
    data: {
      patientId,
      doctorId: doctor.doctorId,
      visitDate: new Date('2025-01-01'),
      department: 'General',
      reason: 'Routine checkup',
    },
  });
  visitId = visit.visitId;

  const doctorUser = await prisma.user.create({
    data: {
      email: 'doctor-clinical@example.com',
      passwordHash: 'x',
      role: 'Doctor',
      doctorId: doctor.doctorId,
    },
  });
  doctorUserId = doctorUser.userId;

  const nurseUser = await prisma.user.create({
    data: { email: 'nurse@example.com', passwordHash: 'x', role: 'Nurse' },
  });
  nurseUserId = nurseUser.userId;

  const labTechUser = await prisma.user.create({
    data: { email: 'labtech@example.com', passwordHash: 'x', role: 'LabTech' },
  });
  labTechUserId = labTechUser.userId;
});

afterAll(async () => {
  if (labOrderId) {
    await prisma.labResult.deleteMany({ where: { labOrderId } });
    await prisma.labOrderItem.deleteMany({ where: { labOrderId } });
    await prisma.labOrder.deleteMany({ where: { labOrderId } });
  }
  await prisma.problem.deleteMany({ where: { patientId } });
  await prisma.vitals.deleteMany({ where: { patientId } });
  await prisma.visit.deleteMany({ where: { visitId } });
  await prisma.patient.deleteMany({ where: { patientId } });
  await prisma.user.deleteMany({ where: { userId: { in: [doctorUserId, nurseUserId, labTechUserId] } } });
  await prisma.doctor.deleteMany({ where: { visits: { some: { visitId } } } });
  await prisma.$disconnect();
});

describe('Clinical workflows', () => {
  it('records vitals, manages problems, and completes lab orders', async () => {
    const nurseAuth = makeAuthHeader(nurseUserId, 'Nurse', 'nurse@example.com');
    const doctorAuth = makeAuthHeader(doctorUserId, 'Doctor', 'doctor-clinical@example.com');
    const labTechAuth = makeAuthHeader(labTechUserId, 'LabTech', 'labtech@example.com');

    const vitalsRes = await request(app)
      .post('/api/vitals')
      .set('Authorization', nurseAuth)
      .send({
        visitId,
        patientId,
        systolic: 120,
        diastolic: 80,
        heartRate: 72,
        temperature: 37.1,
        spo2: 99,
        heightCm: 170,
        weightKg: 65,
      });
    expect(vitalsRes.status).toBe(200);
    expect(vitalsRes.body.bmi).toBeDefined();
    expect(Number(vitalsRes.body.bmi)).toBeCloseTo(22.49, 2);

    const vitalsListRes = await request(app)
      .get(`/api/patients/${patientId}/vitals`)
      .set('Authorization', doctorAuth);
    expect(vitalsListRes.status).toBe(200);
    expect(Array.isArray(vitalsListRes.body.data)).toBe(true);
    expect(vitalsListRes.body.data[0].patientId).toBe(patientId);

    const problemRes = await request(app)
      .post('/api/problems')
      .set('Authorization', doctorAuth)
      .send({
        patientId,
        codeSystem: 'ICD-10',
        code: 'I10',
        display: 'Hypertension',
      });
    expect(problemRes.status).toBe(200);
    expect(problemRes.body.status).toBe('ACTIVE');

    const resolvedRes = await request(app)
      .patch(`/api/problems/${problemRes.body.problemId}/status`)
      .set('Authorization', doctorAuth)
      .send({ status: 'RESOLVED', resolvedDate: new Date().toISOString() });
    expect(resolvedRes.status).toBe(200);
    expect(resolvedRes.body.status).toBe('RESOLVED');

    const labOrderRes = await request(app)
      .post('/api/lab-orders')
      .set('Authorization', doctorAuth)
      .send({
        visitId,
        patientId,
        priority: 'ROUTINE',
        items: [
          { testCode: 'FBS', testName: 'Fasting Blood Sugar' },
          { testCode: 'ALT', testName: 'Alanine Aminotransferase' },
        ],
      });
    expect(labOrderRes.status).toBe(200);
    labOrderId = labOrderRes.body.labOrderId;
    labOrderItemIds = labOrderRes.body.items.map((item: { labOrderItemId: string }) => item.labOrderItemId);
    expect(labOrderItemIds).toHaveLength(2);

    const firstResultRes = await request(app)
      .post('/api/lab-results')
      .set('Authorization', labTechAuth)
      .send({
        labOrderItemId: labOrderItemIds[0],
        patientId,
        resultValueNum: 7.0,
        unit: 'mmol/L',
        referenceLow: 3.9,
        referenceHigh: 5.5,
      });
    expect(firstResultRes.status).toBe(200);
    expect(firstResultRes.body.abnormalFlag).toBe('H');

    const secondResultRes = await request(app)
      .post('/api/lab-results')
      .set('Authorization', labTechAuth)
      .send({
        labOrderItemId: labOrderItemIds[1],
        patientId,
        resultValueNum: 30,
        unit: 'U/L',
        referenceLow: 10,
        referenceHigh: 40,
      });
    expect(secondResultRes.status).toBe(200);

    const orderRecord = await prisma.labOrder.findUnique({
      where: { labOrderId },
      include: { results: true, items: true },
    });
    expect(orderRecord?.status).toBe('COMPLETED');
    expect(orderRecord?.results.length).toBe(2);
    const abnormalFlags = orderRecord?.results.map((result) => result.abnormalFlag);
    expect(abnormalFlags).toContain('H');
  });
});
