import request from 'supertest';
import { app } from '../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let visitId: string;
let patientId: string;

beforeAll(async () => {
  await prisma.user.create({ data: { email: 'meddoc@example.com', passwordHash: 'x', role: 'Doctor' } });
  const doctor = await prisma.doctor.create({ data: { name: 'Dr. M', department: 'Pharma' } });
  const patient = await prisma.patient.create({ data: { name: 'Med Pat', dob: new Date('1990-01-01'), gender: 'M' } });
  patientId = patient.patientId;
  const visit = await prisma.visit.create({ data: { patientId, doctorId: doctor.doctorId, visitDate: new Date('2023-02-01'), department: 'Pharma' } });
  visitId = visit.visitId;
});

afterAll(async () => {
  await prisma.medication.deleteMany({});
  await prisma.visit.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe('Medications', () => {
  it('creates medication and lists', async () => {
    const createRes = await request(app)
      .post(`/api/visits/${visitId}/medications`)
      .send({ drugName: 'Aspirin', dosage: '100mg' });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get(`/api/medications?patient_id=${patientId}&from=2022-01-01&to=2024-01-01`);
    expect(listRes.status).toBe(200);
    expect(listRes.body[0].drugName).toBe('Aspirin');
  });

});
