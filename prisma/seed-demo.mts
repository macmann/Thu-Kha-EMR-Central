import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const CLINICS = [
  {
    code: 'demo-sunrise',
    tenantId: '11111111-1111-1111-1111-111111111120',
    name: 'Sunrise Family Clinic',
    configuration: {
      appName: 'Sunrise Family Clinic',
      contactAddress: '123 Sunrise Road, Yangon',
      contactPhone: '+95 1 234 5678',
      primaryColor: '#f97316',
      accentColor: '#047857',
    },
  },
  {
    code: 'demo-riverside',
    tenantId: '22222222-2222-2222-2222-222222222230',
    name: 'Riverside Specialty Center',
    configuration: {
      appName: 'Riverside Specialty Center',
      contactAddress: '88 Strand Road, Mandalay',
      contactPhone: '+95 2 345 6789',
      primaryColor: '#2563eb',
      accentColor: '#7c3aed',
    },
  },
] as const;

const DOCTORS = [
  {
    doctorId: '33333333-3333-3333-3333-333333333330',
    name: 'Dr. Mya Hnin',
    department: 'Family Medicine',
    clinicCode: 'demo-sunrise',
  },
  {
    doctorId: '44444444-4444-4444-4444-444444444440',
    name: 'Dr. Lin Tun',
    department: 'Cardiology',
    clinicCode: 'demo-riverside',
  },
] as const;

const PATIENT_RECORDS = [
  {
    patientId: '55555555-5555-5555-5555-555555555550',
    name: 'Aye Chan',
    dob: new Date('1992-05-18T00:00:00.000Z'),
    gender: 'F',
    contact: '+95 9 7777 8888',
    clinicCode: 'demo-sunrise',
    mrn: 'SUN-0001',
  },
  {
    patientId: '66666666-6666-6666-6666-666666666660',
    name: 'Aye Chan',
    dob: new Date('1992-05-18T00:00:00.000Z'),
    gender: 'F',
    contact: '+95 9 7777 8888',
    clinicCode: 'demo-riverside',
    mrn: 'RIV-0007',
  },
] as const;

async function ensureClinic(clinic: (typeof CLINICS)[number]) {
  const tenant = await prisma.tenant.upsert({
    where: { code: clinic.code },
    update: {
      name: clinic.name,
    },
    create: {
      tenantId: clinic.tenantId,
      code: clinic.code,
      name: clinic.name,
    },
  });

  await prisma.tenantConfiguration.upsert({
    where: { tenantId: tenant.tenantId },
    update: {
      appName: clinic.configuration.appName,
      contactAddress: clinic.configuration.contactAddress,
      contactPhone: clinic.configuration.contactPhone,
    },
    create: {
      tenantId: tenant.tenantId,
      appName: clinic.configuration.appName,
      contactAddress: clinic.configuration.contactAddress,
      contactPhone: clinic.configuration.contactPhone,
    },
  });

  return tenant;
}

async function ensureDoctors(clinicMap: Map<string, { tenantId: string }>) {
  const doctorMap = new Map<string, { doctorId: string; tenantId: string; department: string }>();

  for (const doctor of DOCTORS) {
    const clinic = clinicMap.get(doctor.clinicCode);
    if (!clinic) continue;

    const record = await prisma.doctor.upsert({
      where: { doctorId: doctor.doctorId },
      update: { name: doctor.name, department: doctor.department },
      create: {
        doctorId: doctor.doctorId,
        name: doctor.name,
        department: doctor.department,
      },
    });

    doctorMap.set(doctor.doctorId, {
      doctorId: record.doctorId,
      tenantId: clinic.tenantId,
      department: doctor.department,
    });
  }

  return doctorMap;
}

async function ensurePatients(clinicMap: Map<string, { tenantId: string }>) {
  const patientMap = new Map<string, { patientId: string; clinicCode: string; tenantId: string }>();

  for (const patient of PATIENT_RECORDS) {
    const clinic = clinicMap.get(patient.clinicCode);
    if (!clinic) continue;

    const record = await prisma.patient.upsert({
      where: { patientId: patient.patientId },
      update: {
        name: patient.name,
        dob: patient.dob,
        gender: patient.gender as Prisma.Gender,
        contact: patient.contact,
      },
      create: {
        patientId: patient.patientId,
        name: patient.name,
        dob: patient.dob,
        gender: patient.gender as Prisma.Gender,
        contact: patient.contact,
      },
    });

    await prisma.patientTenant.upsert({
      where: {
        tenantId_patientId: {
          tenantId: clinic.tenantId,
          patientId: record.patientId,
        },
      },
      update: {
        mrn: patient.mrn,
      },
      create: {
        patientTenantId: randomUUID(),
        tenantId: clinic.tenantId,
        patientId: record.patientId,
        mrn: patient.mrn,
      },
    });

    patientMap.set(`${patient.clinicCode}:${patient.patientId}`, {
      patientId: record.patientId,
      clinicCode: patient.clinicCode,
      tenantId: clinic.tenantId,
    });
  }

  return patientMap;
}

async function seedEncounters({
  clinicMap,
  doctorMap,
  patientMap,
}: {
  clinicMap: Map<string, { tenantId: string }>;
  doctorMap: Map<string, { doctorId: string; tenantId: string; department: string }>;
  patientMap: Map<string, { patientId: string; clinicCode: string; tenantId: string }>;
}) {
  const visitDefinitions = [
    {
      visitId: '77777777-7777-7777-7777-777777777770',
      clinicCode: 'demo-sunrise',
      patientId: '55555555-5555-5555-5555-555555555550',
      doctorId: '33333333-3333-3333-3333-333333333330',
      visitDate: new Date('2025-01-08T00:00:00.000Z'),
      department: 'Family Medicine',
      reason: 'Annual wellness visit and lab review',
      note: {
        id: 'demo-note-sunrise',
        text: 'Patient reports improved sleep and energy. Continue current lifestyle plan. Schedule fasting labs in three months.',
      },
    },
    {
      visitId: '88888888-8888-8888-8888-888888888880',
      clinicCode: 'demo-riverside',
      patientId: '66666666-6666-6666-6666-666666666660',
      doctorId: '44444444-4444-4444-4444-444444444440',
      visitDate: new Date('2025-02-18T00:00:00.000Z'),
      department: 'Cardiology',
      reason: 'Follow-up for palpitations and medication titration',
      note: {
        id: 'demo-note-riverside',
        text: 'Stable vitals today. Adjusted beta-blocker dosage. Educated patient on warning signs and emergency contact numbers.',
      },
    },
  ] as const;

  const visitMap = new Map<string, { visitId: string; tenantId: string }>();

  for (const visitDef of visitDefinitions) {
    const clinic = clinicMap.get(visitDef.clinicCode);
    const patient = patientMap.get(`${visitDef.clinicCode}:${visitDef.patientId}`);
    const doctor = doctorMap.get(visitDef.doctorId);

    if (!clinic || !patient || !doctor) continue;

    const visit = await prisma.visit.upsert({
      where: { visitId: visitDef.visitId },
      update: {
        visitDate: visitDef.visitDate,
        reason: visitDef.reason,
        doctorId: doctor.doctorId,
        department: visitDef.department,
      },
      create: {
        visitId: visitDef.visitId,
        patientId: patient.patientId,
        tenantId: clinic.tenantId,
        visitDate: visitDef.visitDate,
        doctorId: doctor.doctorId,
        department: visitDef.department,
        reason: visitDef.reason,
      },
    });

    const noteContent = visitDef.note.text;

    await prisma.doctorNote.upsert({
      where: { id: visitDef.note.id },
      update: {
        visitId: visit.visitId,
        tenantId: clinic.tenantId,
        patientId: patient.patientId,
        storageType: 'LOCAL',
        storageKey: `demo/${visit.visitId}/note.txt`,
        fileName: 'visit-note.txt',
        contentType: 'text/plain',
        size: Buffer.byteLength(noteContent, 'utf8'),
      },
      create: {
        id: visitDef.note.id,
        visitId: visit.visitId,
        tenantId: clinic.tenantId,
        patientId: patient.patientId,
        storageType: 'LOCAL',
        storageKey: `demo/${visit.visitId}/note.txt`,
        fileName: 'visit-note.txt',
        contentType: 'text/plain',
        size: Buffer.byteLength(noteContent, 'utf8'),
      },
    });

    visitMap.set(visit.visitId, { visitId: visit.visitId, tenantId: clinic.tenantId });
  }

  return visitMap;
}

async function seedAppointments({
  clinicMap,
  doctorMap,
  patientMap,
}: {
  clinicMap: Map<string, { tenantId: string }>;
  doctorMap: Map<string, { doctorId: string; tenantId: string; department: string }>;
  patientMap: Map<string, { patientId: string; clinicCode: string; tenantId: string }>;
}) {
  const appointmentDefinitions = [
    {
      appointmentId: '99999999-9999-9999-9999-999999999990',
      clinicCode: 'demo-sunrise',
      patientId: '55555555-5555-5555-5555-555555555550',
      doctorId: '33333333-3333-3333-3333-333333333330',
      date: new Date('2025-03-12T02:30:00.000Z'),
      startTimeMin: 9 * 60,
      endTimeMin: 9 * 60 + 30,
      reason: 'Quarterly wellness follow-up',
      location: 'Exam Room 2',
      status: 'Scheduled',
    },
    {
      appointmentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa0',
      clinicCode: 'demo-riverside',
      patientId: '66666666-6666-6666-6666-666666666660',
      doctorId: '44444444-4444-4444-4444-444444444440',
      date: new Date('2025-02-18T01:30:00.000Z'),
      startTimeMin: 10 * 60,
      endTimeMin: 10 * 60 + 30,
      reason: 'Medication titration review',
      location: 'Cardiology Suite 1',
      status: 'Completed',
    },
  ] as const;

  for (const appt of appointmentDefinitions) {
    const clinic = clinicMap.get(appt.clinicCode);
    const patient = patientMap.get(`${appt.clinicCode}:${appt.patientId}`);
    const doctor = doctorMap.get(appt.doctorId);
    if (!clinic || !patient || !doctor) continue;

    const doctorMeta = doctorMap.get(appt.doctorId);
    const department = doctorMeta?.department ??
      DOCTORS.find((d) => d.doctorId === appt.doctorId)?.department ??
      'General';

    await prisma.appointment.upsert({
      where: { appointmentId: appt.appointmentId },
      update: {
        date: appt.date,
        startTimeMin: appt.startTimeMin,
        endTimeMin: appt.endTimeMin,
        reason: appt.reason,
        location: appt.location,
        status: appt.status as Prisma.AppointmentStatus,
        department,
      },
      create: {
        appointmentId: appt.appointmentId,
        patientId: patient.patientId,
        doctorId: doctor.doctorId,
        tenantId: clinic.tenantId,
        department,
        date: appt.date,
        startTimeMin: appt.startTimeMin,
        endTimeMin: appt.endTimeMin,
        reason: appt.reason,
        location: appt.location,
        status: appt.status as Prisma.AppointmentStatus,
      },
    });
  }
}

async function seedInvoices({
  clinicMap,
  patientMap,
  visitMap,
}: {
  clinicMap: Map<string, { tenantId: string }>;
  patientMap: Map<string, { patientId: string; clinicCode: string; tenantId: string }>;
  visitMap: Map<string, { visitId: string; tenantId: string }>;
}) {
  const consultService = await prisma.serviceCatalog.findUnique({ where: { code: 'CONSULT_OPD' } });

  const invoiceDefinitions = [
    {
      invoiceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb0',
      visitId: '77777777-7777-7777-7777-777777777770',
      clinicCode: 'demo-sunrise',
      patientId: '55555555-5555-5555-5555-555555555550',
      invoiceNo: 'INV-DEMO-1001',
      status: 'PAID',
      subTotal: new Prisma.Decimal(45000),
      grandTotal: new Prisma.Decimal(45000),
      amountPaid: new Prisma.Decimal(45000),
      lineItem: {
        description: 'Comprehensive wellness consultation',
        amount: new Prisma.Decimal(45000),
        serviceId: consultService?.serviceId,
      },
      payment: {
        paymentId: 'cccccccc-cccc-cccc-cccc-ccccccccccc0',
        method: 'CASH',
        amount: new Prisma.Decimal(45000),
      },
    },
    {
      invoiceId: 'dddddddd-dddd-dddd-dddd-dddddddddddd0',
      visitId: '88888888-8888-8888-8888-888888888880',
      clinicCode: 'demo-riverside',
      patientId: '66666666-6666-6666-6666-666666666660',
      invoiceNo: 'INV-DEMO-2001',
      status: 'PENDING',
      subTotal: new Prisma.Decimal(65000),
      grandTotal: new Prisma.Decimal(65000),
      amountPaid: new Prisma.Decimal(0),
      lineItem: {
        description: 'Cardiology follow-up with ECG',
        amount: new Prisma.Decimal(65000),
        serviceId: consultService?.serviceId,
      },
    },
  ] as const;

  for (const invoiceDef of invoiceDefinitions) {
    const clinic = clinicMap.get(invoiceDef.clinicCode);
    const patient = patientMap.get(`${invoiceDef.clinicCode}:${invoiceDef.patientId}`);
    const visit = visitMap.get(invoiceDef.visitId);

    if (!clinic || !patient || !visit) continue;

    const invoice = await prisma.invoice.upsert({
      where: { invoiceId: invoiceDef.invoiceId },
      update: {
        invoiceNo: invoiceDef.invoiceNo,
        status: invoiceDef.status as Prisma.InvoiceStatus,
        subTotal: invoiceDef.subTotal,
        grandTotal: invoiceDef.grandTotal,
        amountPaid: invoiceDef.amountPaid,
        amountDue: invoiceDef.grandTotal.minus(invoiceDef.amountPaid),
      },
      create: {
        invoiceId: invoiceDef.invoiceId,
        invoiceNo: invoiceDef.invoiceNo,
        visitId: visit.visitId,
        patientId: patient.patientId,
        tenantId: clinic.tenantId,
        status: invoiceDef.status as Prisma.InvoiceStatus,
        subTotal: invoiceDef.subTotal,
        grandTotal: invoiceDef.grandTotal,
        amountPaid: invoiceDef.amountPaid,
        amountDue: invoiceDef.grandTotal.minus(invoiceDef.amountPaid),
      },
    });

    await prisma.invoiceItem.upsert({
      where: { itemId: `${invoice.invoiceId}-item` },
      update: {
        description: invoiceDef.lineItem.description,
        quantity: 1,
        unitPrice: invoiceDef.lineItem.amount,
        lineTotal: invoiceDef.lineItem.amount,
        serviceId: invoiceDef.lineItem.serviceId ?? undefined,
      },
      create: {
        itemId: `${invoice.invoiceId}-item`,
        invoiceId: invoice.invoiceId,
        tenantId: clinic.tenantId,
        sourceType: 'SERVICE',
        serviceId: invoiceDef.lineItem.serviceId ?? undefined,
        description: invoiceDef.lineItem.description,
        quantity: 1,
        unitPrice: invoiceDef.lineItem.amount,
        lineTotal: invoiceDef.lineItem.amount,
      },
    });

    if (invoiceDef.payment) {
      await prisma.payment.upsert({
        where: { paymentId: invoiceDef.payment.paymentId },
        update: {
          invoiceId: invoice.invoiceId,
          amount: invoiceDef.payment.amount,
          method: invoiceDef.payment.method as Prisma.PaymentMethod,
          tenantId: clinic.tenantId,
        },
        create: {
          paymentId: invoiceDef.payment.paymentId,
          invoiceId: invoice.invoiceId,
          tenantId: clinic.tenantId,
          method: invoiceDef.payment.method as Prisma.PaymentMethod,
          amount: invoiceDef.payment.amount,
        },
      });
    }
  }
}

async function main() {
  await import('./seed.mts');

  const clinicMap = new Map<string, { tenantId: string }>();
  for (const clinic of CLINICS) {
    const tenant = await ensureClinic(clinic);
    clinicMap.set(clinic.code, { tenantId: tenant.tenantId });
  }

  const doctorMap = await ensureDoctors(clinicMap);
  const patientMap = await ensurePatients(clinicMap);
  const visitMap = await seedEncounters({ clinicMap, doctorMap, patientMap });
  await seedAppointments({ clinicMap, doctorMap, patientMap });
  await seedInvoices({ clinicMap, patientMap, visitMap });

}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
