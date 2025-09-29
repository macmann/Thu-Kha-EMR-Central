import request from 'supertest';
import { PrismaClient, PrescriptionStatus } from '@prisma/client';
import { app } from '../src/index';

const prisma = new PrismaClient();

function makeAuthHeader(userId: string, role: string, email: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId, role, email })).toString('base64url');
  return `Bearer ${header}.${payload}.`;
}

let doctorId: string;
let patientId: string;
let visitId: string;
let doctorUserId: string;
let pharmacistUserId: string;
let inventoryManagerUserId: string;
let primaryDrugId: string;
let primaryStockId: string;
let primaryInitialQty: number;
let secondaryDrugId: string;
let secondaryStockId: string;
let secondaryInitialQty: number;
let inventoryCreatedDrugId: string | null = null;

beforeAll(async () => {
  const doctor = await prisma.doctor.create({ data: { name: 'Dr Pharma', department: 'Pharmacy' } });
  doctorId = doctor.doctorId;
  const patient = await prisma.patient.create({ data: { name: 'Pharma Patient', dob: new Date('1990-01-01'), gender: 'M' } });
  patientId = patient.patientId;
  const visit = await prisma.visit.create({
    data: {
      patientId,
      doctorId,
      visitDate: new Date('2024-01-01'),
      department: 'Pharmacy',
      reason: 'Medication review',
    },
  });
  visitId = visit.visitId;

  const doctorUser = await prisma.user.create({
    data: {
      email: 'pharma-doctor@example.com',
      passwordHash: 'x',
      role: 'Doctor',
      doctorId,
    },
  });
  doctorUserId = doctorUser.userId;

  const pharmacistUser = await prisma.user.create({
    data: {
      email: 'rx@example.com',
      passwordHash: 'x',
      role: 'Pharmacist',
    },
  });
  pharmacistUserId = pharmacistUser.userId;

  const inventoryManagerUser = await prisma.user.create({
    data: {
      email: 'inventory@example.com',
      passwordHash: 'x',
      role: 'InventoryManager',
    },
  });
  inventoryManagerUserId = inventoryManagerUser.userId;

  const drug = await prisma.drug.create({
    data: {
      name: 'Test Drug A',
      genericName: 'testa',
      form: 'tab',
      strength: '250 mg',
    },
  });
  primaryDrugId = drug.drugId;
  const stock = await prisma.stockItem.create({
    data: {
      drugId: primaryDrugId,
      batchNo: 'A-001',
      expiryDate: new Date('2026-01-01'),
      location: 'COUNTER_A',
      qtyOnHand: 50,
    },
  });
  primaryStockId = stock.stockItemId;
  primaryInitialQty = stock.qtyOnHand;

  const drugB = await prisma.drug.create({
    data: {
      name: 'Test Drug B',
      genericName: 'testb',
      form: 'cap',
      strength: '100 mg',
    },
  });
  secondaryDrugId = drugB.drugId;
  const stockB = await prisma.stockItem.create({
    data: {
      drugId: secondaryDrugId,
      batchNo: 'B-001',
      expiryDate: new Date('2026-06-01'),
      location: 'COUNTER_A',
      qtyOnHand: 40,
    },
  });
  secondaryStockId = stockB.stockItemId;
  secondaryInitialQty = stockB.qtyOnHand;
});

afterAll(async () => {
  await prisma.dispenseItem.deleteMany({});
  await prisma.dispense.deleteMany({});
  await prisma.prescriptionItem.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.stockItem.deleteMany({ where: { stockItemId: { in: [primaryStockId, secondaryStockId] } } });
  await prisma.drug.deleteMany({ where: { drugId: { in: [primaryDrugId, secondaryDrugId] } } });
  await prisma.visit.deleteMany({ where: { visitId } });
  await prisma.patient.deleteMany({ where: { patientId } });
  await prisma.doctor.deleteMany({ where: { doctorId } });
  await prisma.user.deleteMany({ where: { userId: { in: [doctorUserId, pharmacistUserId] } } });
  await prisma.user.deleteMany({ where: { userId: inventoryManagerUserId } });
  if (inventoryCreatedDrugId) {
    await prisma.drug.deleteMany({ where: { drugId: inventoryCreatedDrugId } });
  }
  await prisma.$disconnect();
});

describe('Pharmacy MVP', () => {
  it('allows inventory managers to create new drug records', async () => {
    const inventoryAuth = makeAuthHeader(
      inventoryManagerUserId,
      'InventoryManager',
      'inventory@example.com',
    );

    const createRes = await request(app)
      .post('/api/drugs')
      .set('Authorization', inventoryAuth)
      .send({
        name: 'Inventory Managed Drug',
        genericName: 'inventory-drug',
        form: 'tab',
        strength: '25 mg',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toEqual(
      expect.objectContaining({
        name: 'Inventory Managed Drug',
        genericName: 'inventory-drug',
        form: 'tab',
        strength: '25 mg',
      }),
    );
    inventoryCreatedDrugId = createRes.body.drugId as string;
  });

  it('creates prescription and completes full dispense', async () => {
    const doctorAuth = makeAuthHeader(doctorUserId, 'Doctor', 'pharma-doctor@example.com');
    const pharmacistAuth = makeAuthHeader(pharmacistUserId, 'Pharmacist', 'rx@example.com');

    const createRes = await request(app)
      .post(`/api/visits/${visitId}/prescriptions`)
      .set('Authorization', doctorAuth)
      .send({
        patientId,
        notes: 'Take with food',
        items: [
          {
            drugId: primaryDrugId,
            dose: '250 mg',
            route: 'PO',
            frequency: 'TID',
            durationDays: 5,
            quantityPrescribed: 10,
          },
        ],
      });

    expect(createRes.status).toBe(201);
    const prescription = createRes.body.prescription;
    expect(prescription.items).toHaveLength(1);

    const dispenseRes = await request(app)
      .post(`/api/prescriptions/${prescription.prescriptionId}/dispenses`)
      .set('Authorization', pharmacistAuth);

    expect(dispenseRes.status).toBe(201);
    const dispenseId = dispenseRes.body.dispenseId as string;

    const dispenseItemRes = await request(app)
      .post(`/api/dispenses/${dispenseId}/items`)
      .set('Authorization', pharmacistAuth)
      .send({
        prescriptionItemId: prescription.items[0].itemId,
        stockItemId: primaryStockId,
        drugId: primaryDrugId,
        quantity: 10,
      });

    expect(dispenseItemRes.status).toBe(201);

    const completeRes = await request(app)
      .patch(`/api/dispenses/${dispenseId}/complete`)
      .set('Authorization', pharmacistAuth)
      .send({ status: 'COMPLETED' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.prescriptionStatus).toBe(PrescriptionStatus.DISPENSED);

    const updatedPrescription = await prisma.prescription.findUnique({
      where: { prescriptionId: prescription.prescriptionId },
    });
    expect(updatedPrescription?.status).toBe(PrescriptionStatus.DISPENSED);

    const stock = await prisma.stockItem.findUnique({ where: { stockItemId: primaryStockId } });
    expect(stock?.qtyOnHand).toBe(primaryInitialQty - 10);
  });

  it('supports partial dispense tracking', async () => {
    const doctorAuth = makeAuthHeader(doctorUserId, 'Doctor', 'pharma-doctor@example.com');
    const pharmacistAuth = makeAuthHeader(pharmacistUserId, 'Pharmacist', 'rx@example.com');

    const createRes = await request(app)
      .post(`/api/visits/${visitId}/prescriptions`)
      .set('Authorization', doctorAuth)
      .send({
        patientId,
        notes: 'Use as needed',
        items: [
          {
            drugId: secondaryDrugId,
            dose: '100 mg',
            route: 'PO',
            frequency: 'BID',
            durationDays: 3,
            quantityPrescribed: 12,
          },
        ],
      });

    expect(createRes.status).toBe(201);
    const prescription = createRes.body.prescription;

    const dispenseRes = await request(app)
      .post(`/api/prescriptions/${prescription.prescriptionId}/dispenses`)
      .set('Authorization', pharmacistAuth);

    expect(dispenseRes.status).toBe(201);
    const dispenseId = dispenseRes.body.dispenseId as string;

    await request(app)
      .post(`/api/dispenses/${dispenseId}/items`)
      .set('Authorization', pharmacistAuth)
      .send({
        prescriptionItemId: prescription.items[0].itemId,
        stockItemId: secondaryStockId,
        drugId: secondaryDrugId,
        quantity: 5,
      })
      .expect(201);

    const completeRes = await request(app)
      .patch(`/api/dispenses/${dispenseId}/complete`)
      .set('Authorization', pharmacistAuth)
      .send({ status: 'PARTIAL' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.prescriptionStatus).toBe(PrescriptionStatus.PARTIAL);

    const updatedPrescription = await prisma.prescription.findUnique({
      where: { prescriptionId: prescription.prescriptionId },
    });
    expect(updatedPrescription?.status).toBe(PrescriptionStatus.PARTIAL);

    const stock = await prisma.stockItem.findUnique({ where: { stockItemId: secondaryStockId } });
    expect(stock?.qtyOnHand).toBe(secondaryInitialQty - 5);
  });
});
