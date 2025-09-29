import request from 'supertest';
import { app } from '../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let visitId: string;
let patientId: string;

beforeAll(async () => {
  await prisma.user.create({ data: { email: 'labdoc@example.com', passwordHash: 'x', role: 'Doctor' } });
  const doctor = await prisma.doctor.create({ data: { name: 'Dr. L', department: 'Lab' } });
  const patient = await prisma.patient.create({ data: { name: 'Lab Pat', dob: new Date('1990-01-01'), gender: 'F' } });
  patientId = patient.patientId;
  const visit = await prisma.visit.create({ data: { patientId, doctorId: doctor.doctorId, visitDate: new Date('2023-03-01'), department: 'Lab' } });
  visitId = visit.visitId;
});

afterAll(async () => {
  await prisma.labResult.deleteMany({});
  await prisma.visit.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe('Lab results', () => {
  it('creates lab and lists with filters', async () => {
    const createRes = await request(app)
      .post(`/api/visits/${visitId}/labs`)
      .send({ testName: 'CBC', resultValue: 4.5, unit: 'x', testDate: '2023-03-02' });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get(`/api/labs?patient_id=${patientId}&test_name=CBC&min=4&max=5&from=2023-03-01&to=2023-03-10`);
    expect(listRes.status).toBe(200);
    expect(listRes.body[0].testName).toBe('CBC');
  });

});
