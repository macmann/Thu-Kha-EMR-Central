import request from 'supertest';
import { PrismaClient } from '@prisma/client';
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
let cashierUserId: string;
let pharmacistUserId: string;
let serviceId: string;
let invoiceId: string;
let pharmacyDrugId: string;
let prescriptionId: string;
let dispenseId: string;

beforeAll(async () => {
  const doctor = await prisma.doctor.create({ data: { name: 'Dr Billing', department: 'General' } });
  doctorId = doctor.doctorId;
  const patient = await prisma.patient.create({
    data: {
      name: 'Billing Patient',
      dob: new Date('1990-01-01'),
      gender: 'M',
    },
  });
  patientId = patient.patientId;
  const visit = await prisma.visit.create({
    data: {
      patientId,
      doctorId,
      visitDate: new Date('2024-01-01'),
      department: 'General',
      reason: 'Routine check',
    },
  });
  visitId = visit.visitId;

  const cashier = await prisma.user.create({
    data: {
      email: 'cashier@example.com',
      passwordHash: 'x',
      role: 'Cashier',
    },
  });
  cashierUserId = cashier.userId;

  const pharmacist = await prisma.user.create({
    data: {
      email: 'pharma-cashier@example.com',
      passwordHash: 'x',
      role: 'Pharmacist',
    },
  });
  pharmacistUserId = pharmacist.userId;

  const service = await prisma.serviceCatalog.create({
    data: {
      code: 'CONSULT_TEST',
      name: 'Test Consultation',
      defaultPrice: '8000.00',
    },
  });
  serviceId = service.serviceId;
});

afterAll(async () => {
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.serviceCatalog.deleteMany({ where: { serviceId } });
  if (dispenseId) {
    await prisma.dispenseItem.deleteMany({ where: { dispenseId } });
    await prisma.dispense.deleteMany({ where: { dispenseId } });
  }
  if (prescriptionId) {
    await prisma.prescriptionItem.deleteMany({ where: { prescriptionId } });
    await prisma.prescription.deleteMany({ where: { prescriptionId } });
  }
  if (pharmacyDrugId) {
    await prisma.drug.deleteMany({ where: { drugId: pharmacyDrugId } });
  }
  await prisma.visit.deleteMany({ where: { visitId } });
  await prisma.patient.deleteMany({ where: { patientId } });
  await prisma.doctor.deleteMany({ where: { doctorId } });
  await prisma.user.deleteMany({ where: { userId: { in: [cashierUserId, pharmacistUserId] } } });
  await prisma.$disconnect();
});

describe('Billing & invoicing', () => {
  it('creates invoice with items and computes totals', async () => {
    const cashierAuth = makeAuthHeader(cashierUserId, 'Cashier', 'cashier@example.com');

    const createRes = await request(app)
      .post('/api/billing/invoices')
      .set('Authorization', cashierAuth)
      .send({
        visitId,
        patientId,
        items: [
          {
            sourceType: 'SERVICE',
            serviceId,
            description: 'Consultation',
            quantity: 1,
            unitPrice: '8000.00',
          },
        ],
      });

    expect(createRes.status).toBe(201);
    invoiceId = createRes.body.invoiceId as string;
    expect(createRes.body.status).toBe('PENDING');
    expect(createRes.body.subTotal).toBe('8000.00');
    expect(createRes.body.grandTotal).toBe('8000.00');

    const detailRes = await request(app)
      .get(`/api/billing/invoices/${invoiceId}`)
      .set('Authorization', cashierAuth);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.items).toHaveLength(1);
    expect(detailRes.body.amountDue).toBe('8000.00');
  });

  it('records partial payment and updates status', async () => {
    const cashierAuth = makeAuthHeader(cashierUserId, 'Cashier', 'cashier@example.com');

    const paymentRes = await request(app)
      .post(`/api/billing/invoices/${invoiceId}/payments`)
      .set('Authorization', cashierAuth)
      .send({ amount: '3000.00', method: 'CASH' });

    expect(paymentRes.status).toBe(201);

    const detailRes = await request(app)
      .get(`/api/billing/invoices/${invoiceId}`)
      .set('Authorization', cashierAuth);

    expect(detailRes.body.amountPaid).toBe('3000.00');
    expect(detailRes.body.amountDue).toBe('5000.00');
    expect(detailRes.body.status).toBe('PARTIALLY_PAID');
  });

  it('records full payment and closes invoice', async () => {
    const cashierAuth = makeAuthHeader(cashierUserId, 'Cashier', 'cashier@example.com');

    const paymentRes = await request(app)
      .post(`/api/billing/invoices/${invoiceId}/payments`)
      .set('Authorization', cashierAuth)
      .send({ amount: '5000.00', method: 'CARD' });

    expect(paymentRes.status).toBe(201);

    const detailRes = await request(app)
      .get(`/api/billing/invoices/${invoiceId}`)
      .set('Authorization', cashierAuth);

    expect(detailRes.body.amountPaid).toBe('8000.00');
    expect(detailRes.body.amountDue).toBe('0.00');
    expect(detailRes.body.status).toBe('PAID');
  });

  it('void invoice prevents further mutations', async () => {
    const cashierAuth = makeAuthHeader(cashierUserId, 'Cashier', 'cashier@example.com');

    const createRes = await request(app)
      .post('/api/billing/invoices')
      .set('Authorization', cashierAuth)
      .send({ visitId, patientId });

    expect(createRes.status).toBe(201);
    const voidInvoiceId = createRes.body.invoiceId as string;

    const voidRes = await request(app)
      .post(`/api/billing/invoices/${voidInvoiceId}/void`)
      .set('Authorization', cashierAuth)
      .send({ reason: 'Test void' });

    expect(voidRes.status).toBe(200);
    expect(voidRes.body.status).toBe('VOID');

    const addItemRes = await request(app)
      .patch(`/api/billing/invoices/${voidInvoiceId}/items`)
      .set('Authorization', cashierAuth)
      .send({
        add: [
          {
            sourceType: 'SERVICE',
            serviceId,
            description: 'Follow up',
            quantity: 1,
            unitPrice: '1000.00',
          },
        ],
      });

    expect(addItemRes.status).toBe(400);

    const paymentRes = await request(app)
      .post(`/api/billing/invoices/${voidInvoiceId}/payments`)
      .set('Authorization', cashierAuth)
      .send({ amount: '1000.00', method: 'CASH' });

    expect(paymentRes.status).toBe(400);
  });

  it('posts pharmacy charges once for completed dispense', async () => {
    const pharmacistAuth = makeAuthHeader(
      pharmacistUserId,
      'Pharmacist',
      'pharma-cashier@example.com',
    );
    const cashierAuth = makeAuthHeader(cashierUserId, 'Cashier', 'cashier@example.com');

    const drug = await prisma.drug.create({
      data: {
        name: 'Dispense Drug',
        genericName: 'dispense',
        form: 'tab',
        strength: '10 mg',
      },
    });
    pharmacyDrugId = drug.drugId;

    const prescription = await prisma.prescription.create({
      data: {
        visitId,
        doctorId,
        patientId,
        items: {
          create: [
            {
              drugId: drug.drugId,
              dose: '10 mg',
              route: 'PO',
              frequency: 'BID',
              durationDays: 5,
              quantityPrescribed: 10,
            },
          ],
        },
      },
      include: { items: true },
    });
    prescriptionId = prescription.prescriptionId;

    const dispense = await prisma.dispense.create({
      data: {
        prescriptionId: prescription.prescriptionId,
        pharmacistId: pharmacistUserId,
        status: 'READY',
        items: {
          create: [
            {
              prescriptionItemId: prescription.items[0].itemId,
              drugId: drug.drugId,
              quantity: 5,
              unitPrice: '0.00',
            },
          ],
        },
      },
      include: { items: true },
    });
    dispenseId = dispense.dispenseId;

    const completeRes = await request(app)
      .patch(`/api/dispenses/${dispenseId}/complete`)
      .set('Authorization', pharmacistAuth)
      .send({ status: 'COMPLETED' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.invoiceId).toBeTruthy();
    const pharmacyInvoiceId = completeRes.body.invoiceId as string;

    const listRes = await request(app)
      .get(`/api/billing/invoices?visitId=${visitId}`)
      .set('Authorization', cashierAuth);

    expect(listRes.status).toBe(200);
    const matching = listRes.body.data.find(
      (entry: { invoiceId: string }) => entry.invoiceId === pharmacyInvoiceId,
    );
    expect(matching).toBeDefined();

    const detailRes = await request(app)
      .get(`/api/billing/invoices/${pharmacyInvoiceId}`)
      .set('Authorization', cashierAuth);

    expect(detailRes.body.items).toHaveLength(1);

    const repostRes = await request(app)
      .post(`/api/billing/post-pharmacy/${prescriptionId}`)
      .set('Authorization', pharmacistAuth);

    expect(repostRes.status).toBe(200);
    expect(repostRes.body.invoiceId).toBe(pharmacyInvoiceId);

    const detailAgain = await request(app)
      .get(`/api/billing/invoices/${pharmacyInvoiceId}`)
      .set('Authorization', cashierAuth);

    expect(detailAgain.body.items).toHaveLength(1);
  });
});
