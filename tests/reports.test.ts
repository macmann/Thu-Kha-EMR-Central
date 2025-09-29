import request from 'supertest';
import { PrismaClient } from '@prisma/client';

import { app } from '../src/index';

const prisma = new PrismaClient();

function buildToken({
  userId,
  role,
  email,
  doctorId = null,
}: {
  userId: string;
  role: string;
  email: string;
  doctorId?: string | null;
}) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      role,
      email,
      doctorId,
    }),
  ).toString('base64url');
  return `${header}.${payload}.`;
}

describe('GET /api/reports/summary', () => {
  const uniqueDiagnosis = 'Neuro reporting case';
  const uniqueDepartment = 'Neuro Analytics';
  const uniqueLab = 'Neuro Panel';
  let authHeader: string;
  let patientId: string;
  let doctorId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'reports-user@example.com',
        passwordHash: 'hash',
        role: 'ITAdmin',
        status: 'active',
      },
    });

    authHeader = `Bearer ${buildToken({
      userId: user.userId,
      role: user.role,
      email: user.email,
      doctorId: null,
    })}`;

    const doctor = await prisma.doctor.create({
      data: {
        name: 'Reporting Doctor',
        department: uniqueDepartment,
      },
    });
    doctorId = doctor.doctorId;

    const patient = await prisma.patient.create({
      data: {
        name: 'Reporting Patient',
        dob: new Date('1990-01-01'),
        gender: 'F',
        insurance: 'Aetna',
      },
    });
    patientId = patient.patientId;

    const recentVisit = await prisma.visit.create({
      data: {
        patientId,
        doctorId,
        visitDate: new Date(),
        department: uniqueDepartment,
        reason: 'reporting follow up',
      },
    });

    const historicalVisitDate = new Date();
    historicalVisitDate.setDate(historicalVisitDate.getDate() - 120);
    await prisma.visit.create({
      data: {
        patientId,
        doctorId,
        visitDate: historicalVisitDate,
        department: 'Legacy Care',
        reason: 'old history',
      },
    });

    await prisma.diagnosis.create({
      data: { visitId: recentVisit.visitId, diagnosis: uniqueDiagnosis },
    });

    await prisma.labResult.create({
      data: {
        visitId: recentVisit.visitId,
        testName: uniqueLab,
        resultValue: 4.2,
        unit: 'mg/dL',
        testDate: new Date(),
      },
    });

    const upcoming = new Date();
    upcoming.setDate(upcoming.getDate() + 3);
    await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        department: uniqueDepartment,
        date: upcoming,
        startTimeMin: 9 * 60,
        endTimeMin: 9 * 60 + 30,
        status: 'Scheduled',
      },
    });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { doctorId } });
    await prisma.labResult.deleteMany({ where: { testName: uniqueLab } });
    await prisma.diagnosis.deleteMany({ where: { diagnosis: uniqueDiagnosis } });
    await prisma.visit.deleteMany({ where: { patientId } });
    await prisma.patient.deleteMany({ where: { patientId } });
    await prisma.doctor.deleteMany({ where: { doctorId } });
    await prisma.user.deleteMany({ where: { email: 'reports-user@example.com' } });
    await prisma.$disconnect();
  });

  it('returns aggregated operational data', async () => {
    const res = await request(app).get('/api/reports/summary').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.totals).toBeDefined();
    expect(res.body.totals.patients).toBeGreaterThanOrEqual(1);
    expect(res.body.totals.visitsLast30Days).toBeGreaterThanOrEqual(1);
    expect(res.body.totals.upcomingAppointments).toBeGreaterThanOrEqual(1);

    const departmentRow = res.body.visitsByDepartment.find((row: any) => row.department === uniqueDepartment);
    expect(departmentRow).toBeDefined();
    expect(departmentRow.visitCount).toBeGreaterThanOrEqual(1);
    expect(departmentRow.patientCount).toBeGreaterThanOrEqual(1);

    const diagnosisRow = res.body.topDiagnoses.find((row: any) => row.diagnosis === uniqueDiagnosis);
    expect(diagnosisRow).toBeDefined();
    expect(diagnosisRow.count).toBeGreaterThanOrEqual(1);

    const labRow = res.body.labSummaries.find((row: any) => row.testName === uniqueLab);
    expect(labRow).toBeDefined();
    expect(labRow.tests).toBeGreaterThanOrEqual(1);
    expect(typeof labRow.lastTestDate).toBe('string');

    expect(Array.isArray(res.body.monthlyVisitTrends)).toBe(true);
  });
});

