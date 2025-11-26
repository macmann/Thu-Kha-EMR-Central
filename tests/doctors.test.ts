import request from 'supertest';
import { app } from '../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.doctor.deleteMany({});
});

afterAll(async () => {
  await prisma.doctor.deleteMany({});
  await prisma.$disconnect();
});

describe('Doctor management', () => {
  it('creates and lists doctors', async () => {
    const createRes = await request(app)
      .post('/api/doctors')
      .send({ name: 'Dr. Test', department: 'Testing' });
    expect(createRes.status).toBe(201);
    const id = createRes.body.doctorId;
    expect(id).toBeDefined();

    const listRes = await request(app).get('/api/doctors');
    expect(listRes.status).toBe(200);
    const ids = listRes.body.map((d: any) => d.doctorId);
    expect(ids).toContain(id);
  });
});

describe('Doctor availability management', () => {
  let availabilityDoctorId: string;

  beforeAll(async () => {
    const doctor = await prisma.doctor.create({
      data: {
        name: 'Availability Doctor',
        department: 'General Medicine',
      },
    });
    availabilityDoctorId = doctor.doctorId;
  });

  afterAll(async () => {
    await prisma.doctorAvailability.deleteMany({ where: { doctorId: availabilityDoctorId } });
    await prisma.doctor.deleteMany({ where: { doctorId: availabilityDoctorId } });
  });

  it('returns default availability when no custom slots exist', async () => {
    const res = await request(app).get(`/api/doctors/${availabilityDoctorId}/availability`);

    expect(res.status).toBe(200);
    expect(res.body.doctorId).toBe(availabilityDoctorId);
    expect(Array.isArray(res.body.availability)).toBe(true);
    expect(res.body.availability).toHaveLength(0);
    expect(res.body.defaultAvailability).toEqual([
      { startMin: 9 * 60, endMin: 17 * 60 },
    ]);
  });

  it('creates a custom availability slot and prevents overlaps', async () => {
    const createRes = await request(app)
      .post(`/api/doctors/${availabilityDoctorId}/availability`)
      .send({ dayOfWeek: 1, startMin: 9 * 60, endMin: 12 * 60 });

    expect(createRes.status).toBe(201);
    expect(createRes.body.doctorId).toBe(availabilityDoctorId);
    expect(createRes.body.startMin).toBe(9 * 60);
    expect(createRes.body.endMin).toBe(12 * 60);

    const conflictRes = await request(app)
      .post(`/api/doctors/${availabilityDoctorId}/availability`)
      .send({ dayOfWeek: 1, startMin: 11 * 60, endMin: 13 * 60 });

    expect(conflictRes.status).toBe(409);

    const listRes = await request(app).get(`/api/doctors/${availabilityDoctorId}/availability`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.availability).toHaveLength(1);
    expect(listRes.body.availability[0]).toMatchObject({
      dayOfWeek: 1,
      startMin: 9 * 60,
      endMin: 12 * 60,
    });
  });
});

describe('Doctor availability updates', () => {
  let doctorId: string;
  let availabilityId: string;

  beforeAll(async () => {
    const doctor = await prisma.doctor.create({
      data: {
        name: 'Updatable Doctor',
        department: 'Orthopedics',
      },
    });

    doctorId = doctor.doctorId;

    const availability = await prisma.doctorAvailability.create({
      data: {
        doctorId,
        dayOfWeek: 2,
        startMin: 8 * 60,
        endMin: 12 * 60,
      },
    });

    availabilityId = availability.availabilityId;
  });

  afterAll(async () => {
    await prisma.doctorAvailability.deleteMany({ where: { doctorId } });
    await prisma.doctor.deleteMany({ where: { doctorId } });
  });

  it('updates an availability slot and enforces overlap detection', async () => {
    const updateRes = await request(app)
      .patch(`/api/doctors/${doctorId}/availability/${availabilityId}`)
      .send({ startMin: 7 * 60, endMin: 11 * 60 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({
      availabilityId,
      doctorId,
      startMin: 7 * 60,
      endMin: 11 * 60,
    });

    const secondSlot = await prisma.doctorAvailability.create({
      data: {
        doctorId,
        dayOfWeek: 2,
        startMin: 12 * 60,
        endMin: 14 * 60,
      },
    });

    const conflictRes = await request(app)
      .patch(`/api/doctors/${doctorId}/availability/${availabilityId}`)
      .send({ endMin: 13 * 60 });

    expect(conflictRes.status).toBe(409);

    await prisma.doctorAvailability.delete({ where: { availabilityId: secondSlot.availabilityId } });
  });
});

