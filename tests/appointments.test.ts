import request from 'supertest';
import { PrismaClient } from '@prisma/client';

import { app } from '../src/index';

const prisma = new PrismaClient();
const appointmentDate = '2025-03-10';
const startOfDayMinutes = 9 * 60;
const endOfDayMinutes = 10 * 60;
const defaultWindowEnd = 17 * 60;

let patientId!: string;
let doctorId!: string;

beforeAll(async () => {
  const patient = await prisma.patient.create({
    data: {
      name: 'Appointment Patient',
      dob: new Date('1980-07-01'),
      gender: 'F',
      contact: '555-0100',
      insurance: 'Premium Health',
    },
  });
  patientId = patient.patientId;

  const doctor = await prisma.doctor.create({
    data: {
      name: 'Appointment Doctor',
      department: 'Cardiology',
    },
  });
  doctorId = doctor.doctorId;

});

afterEach(async () => {
  await prisma.visit.deleteMany({ where: { doctorId } });
  await prisma.appointment.deleteMany({ where: { doctorId } });
});

afterAll(async () => {
  await prisma.visit.deleteMany({ where: { doctorId } });
  await prisma.appointment.deleteMany({ where: { doctorId } });
  await prisma.doctorAvailability.deleteMany({ where: { doctorId } });
  await prisma.patient.deleteMany({ where: { patientId } });
  await prisma.doctor.deleteMany({ where: { doctorId } });
  await prisma.$disconnect();
});

describe('POST /api/appointments', () => {
  it('creates a valid appointment', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        patientId,
        doctorId,
        department: 'Cardiology',
        date: appointmentDate,
        startTimeMin: startOfDayMinutes,
        endTimeMin: startOfDayMinutes + 30,
        reason: 'Routine checkup',
      });

    expect(res.status).toBe(201);
    expect(res.body.appointmentId).toBeDefined();
    expect(res.body.status).toBe('Scheduled');
    expect(res.body.patient.patientId).toBe(patientId);
    expect(res.body.doctor.doctorId).toBe(doctorId);
  });

  it('returns conflict when appointment overlaps existing one', async () => {
    const initial = await request(app)
      .post('/api/appointments')
      .send({
        patientId,
        doctorId,
        department: 'Cardiology',
        date: appointmentDate,
        startTimeMin: startOfDayMinutes,
        endTimeMin: startOfDayMinutes + 30,
        reason: 'Morning visit',
      });

    expect(initial.status).toBe(201);

    const overlap = await request(app)
      .post('/api/appointments')
      .send({
        patientId,
        doctorId,
        department: 'Cardiology',
        date: appointmentDate,
        startTimeMin: startOfDayMinutes + 15,
        endTimeMin: startOfDayMinutes + 45,
        reason: 'Conflicting visit',
      });

    expect(overlap.status).toBe(409);
    expect(overlap.body.message).toContain('overlaps');
  });
});

describe('GET /api/appointments', () => {
  it('returns appointments for a specific date', async () => {
    const creation = await request(app)
      .post('/api/appointments')
      .send({
        patientId,
        doctorId,
        department: 'Cardiology',
        date: appointmentDate,
        startTimeMin: startOfDayMinutes,
        endTimeMin: startOfDayMinutes + 30,
        reason: 'Listed visit',
      });

    expect(creation.status).toBe(201);

    const listRes = await request(app)
      .get('/api/appointments')
      .query({ date: appointmentDate, limit: '10' });

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].date).toContain(appointmentDate);
  });

  it('rejects invalid calendar dates', async () => {
    const res = await request(app)
      .get('/api/appointments')
      .query({ date: '2025-02-30' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid/i);
  });
});

describe('PATCH /api/appointments/:id/status', () => {
  it('creates a visit when marking appointment completed', async () => {
    const createRes = await request(app)
      .post('/api/appointments')
      .send({
        patientId,
        doctorId,
        department: 'Cardiology',
        date: appointmentDate,
        startTimeMin: startOfDayMinutes,
        endTimeMin: startOfDayMinutes + 30,
        reason: 'Follow up',
      });

    expect(createRes.status).toBe(201);
    const appointmentId = createRes.body.appointmentId;

    const patchRes = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .send({ status: 'Completed' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.visitId).toBeDefined();

    const visit = await prisma.visit.findUnique({ where: { visitId: patchRes.body.visitId } });
    expect(visit).not.toBeNull();
    expect(visit?.patientId).toBe(patientId);
    expect(visit?.doctorId).toBe(doctorId);
    expect(visit?.department).toBe('Cardiology');
  });
});

describe('GET /api/appointments/availability', () => {
  it('returns remaining free slots when part of the day is booked', async () => {
    const resCreate = await request(app)
      .post('/api/appointments')
      .send({
        patientId,
        doctorId,
        department: 'Cardiology',
        date: appointmentDate,
        startTimeMin: startOfDayMinutes,
        endTimeMin: endOfDayMinutes,
        reason: 'Extended visit',
      });

    expect(resCreate.status).toBe(201);

    const availabilityRes = await request(app)
      .get('/api/appointments/availability')
      .query({ doctorId, date: appointmentDate });

    expect(availabilityRes.status).toBe(200);
    expect(Array.isArray(availabilityRes.body.freeSlots)).toBe(true);
    expect(availabilityRes.body.freeSlots).toEqual([
      { startMin: endOfDayMinutes, endMin: defaultWindowEnd },
    ]);
    expect(availabilityRes.body.blocked).toEqual([
      { startMin: startOfDayMinutes, endMin: endOfDayMinutes },
    ]);
    expect(availabilityRes.body.availability).toEqual([
      { startMin: startOfDayMinutes, endMin: defaultWindowEnd },
    ]);
  });

  it('enforces the default availability window', async () => {
    const response = await request(app)
      .post('/api/appointments')
      .send({
        patientId,
        doctorId,
        department: 'Cardiology',
        date: appointmentDate,
        startTimeMin: 7 * 60,
        endTimeMin: 8 * 60,
        reason: 'Too early visit',
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toContain('outside doctor availability');
  });
});
