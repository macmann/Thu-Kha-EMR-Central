import { Router, type Request, type Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth } from '../auth/index.js';

const prisma = new PrismaClient();
const router = Router();

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function daysAgo(reference: Date, days: number): Date {
  const copy = new Date(reference);
  copy.setDate(copy.getDate() - days);
  return copy;
}

function daysAhead(reference: Date, days: number): Date {
  const copy = new Date(reference);
  copy.setDate(copy.getDate() + days);
  return copy;
}

router.get('/summary', requireAuth, async (_req: Request, res: Response) => {
  const today = startOfToday();
  const last30Days = daysAgo(today, 30);
  const last90Days = daysAgo(today, 90);
  const nextSevenDaysEnd = daysAhead(today, 7);
  nextSevenDaysEnd.setHours(23, 59, 59, 999);

  const [
    totalPatients,
    totalDoctors,
    visitsLast30Days,
    upcomingAppointments,
    activePatients,
    visitsByDepartmentRows,
    topDiagnosesRows,
    labSummariesRows,
    monthlyVisitTrendRows,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.visit.count({ where: { visitDate: { gte: last30Days } } }),
    prisma.appointment.count({
      where: {
        date: { gte: today, lte: nextSevenDaysEnd },
        status: { in: ['Scheduled', 'CheckedIn', 'InProgress'] },
      },
    }),
    prisma.visit
      .findMany({
        where: { visitDate: { gte: last90Days } },
        distinct: ['patientId'],
        select: { patientId: true },
      })
      .then((rows) => rows.length),
    prisma.$queryRaw<Array<{ department: string; visit_count: bigint; patient_count: bigint }>>(
      Prisma.sql`
        SELECT department,
               COUNT(*) AS visit_count,
               COUNT(DISTINCT "patientId") AS patient_count
        FROM "Visit"
        WHERE "visitDate" >= ${last90Days}
        GROUP BY department
        ORDER BY visit_count DESC, department ASC
      `,
    ),
    prisma.diagnosis.groupBy({
      by: ['diagnosis'],
      _count: { diagnosis: true },
      orderBy: { _count: { diagnosis: 'desc' } },
      take: 10,
    }),
    prisma.visitLabResult.groupBy({
      by: ['testName'],
      where: { testDate: { not: null } },
      _count: { labId: true },
      _avg: { resultValue: true },
      _max: { testDate: true },
      orderBy: { _count: { labId: 'desc' } },
      take: 10,
    }),
    prisma.$queryRaw<Array<{ month: Date; visit_count: bigint }>>(
      Prisma.sql`
        SELECT date_trunc('month', "visitDate") AS month,
               COUNT(*) AS visit_count
        FROM "Visit"
        WHERE "visitDate" >= ${daysAgo(today, 180)}
        GROUP BY month
        ORDER BY month ASC
      `,
    ),
  ]);

  const visitsByDepartment = visitsByDepartmentRows.map((row) => ({
    department: row.department,
    visitCount: Number(row.visit_count),
    patientCount: Number(row.patient_count),
  }));

  const topDiagnoses = topDiagnosesRows.map((row) => ({
    diagnosis: row.diagnosis,
    count: row._count.diagnosis,
  }));

  const labSummaries = labSummariesRows.map((row) => ({
    testName: row.testName,
    tests: row._count.labId,
    averageValue: row._avg.resultValue ?? null,
    lastTestDate: row._max.testDate ? row._max.testDate.toISOString() : null,
  }));

  const monthlyVisitTrends = monthlyVisitTrendRows.map((row) => ({
    month: row.month.toISOString(),
    visitCount: Number(row.visit_count),
  }));

  res.json({
    totals: {
      patients: totalPatients,
      doctors: totalDoctors,
      activePatients,
      visitsLast30Days,
      upcomingAppointments,
    },
    visitsByDepartment,
    topDiagnoses,
    labSummaries,
    monthlyVisitTrends,
  });
});

export default router;

