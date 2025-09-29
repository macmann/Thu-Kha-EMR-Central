import request from 'supertest';
import { app } from '../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let patientId: string;
let doctorId: string;
let visitId: string;

beforeAll(async () => {
  await prisma.user.create({ data: { email: 'visitdoc@example.com', passwordHash: 'x', role: 'Doctor' } });
  const doctor = await prisma.doctor.create({ data: { name: 'Dr. House', department: 'Diagnostics' } });
  doctorId = doctor.doctorId;
  const patient = await prisma.patient.create({ data: { name: 'Greg Patient', dob: new Date('1985-05-05'), gender: 'M' } });
  patientId = patient.patientId;
  // existing older visit for ordering
  await prisma.visit.create({ data: { patientId, doctorId, visitDate: new Date('2023-01-01'), department: 'Diagnostics', reason: 'old' } });
});

afterAll(async () => {
  await prisma.observation.deleteMany({});
  await prisma.labResult.deleteMany({});
  await prisma.medication.deleteMany({});
  await prisma.diagnosis.deleteMany({});
  await prisma.visit.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe('Visit lifecycle', () => {
  it('creates visit with nested details and retrieves them', async () => {
    const createRes = await request(app)
      .post('/api/visits')
      .send({
        patientId,
        visitDate: '2023-03-01',
        doctorId,
        department: 'Diagnostics',
        reason: 'checkup',
        diagnoses: [{ diagnosis: 'Flu' }],
        medications: [{ drugName: 'Tamiflu' }],
        labResults: [{ testName: 'CBC', resultValue: 4.5, unit: 'x', testDate: '2023-03-02' }],
        observations: [{ noteText: 'note1' }, { noteText: 'note2' }],
      });
    expect(createRes.status).toBe(201);
    visitId = createRes.body.visitId;
    expect(createRes.body.doctor.doctorId).toBe(doctorId);
    expect(createRes.body.diagnoses[0].diagnosis).toBe('Flu');
    expect(createRes.body.medications[0].drugName).toBe('Tamiflu');
    expect(createRes.body.labResults[0].testName).toBe('CBC');
    const notes = createRes.body.observations.map((o: any) => o.noteText).sort();
    expect(notes).toEqual(['note1', 'note2']);

    const listRes = await request(app).get(`/api/patients/${patientId}/visits`);
    expect(listRes.status).toBe(200);
    expect(listRes.body[0].visitId).toBe(visitId);
    expect(listRes.body[0].doctor.name).toBe('Dr. House');

    const detailRes = await request(app).get(`/api/visits/${visitId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.doctor.name).toBe('Dr. House');
    expect(detailRes.body.diagnoses[0].diagnosis).toBe('Flu');
    expect(detailRes.body.medications[0].drugName).toBe('Tamiflu');
    expect(detailRes.body.labResults[0].testName).toBe('CBC');
    const detailNotes = detailRes.body.observations.map((o: any) => o.noteText).sort();
    expect(detailNotes).toEqual(['note1', 'note2']);
  });
});
