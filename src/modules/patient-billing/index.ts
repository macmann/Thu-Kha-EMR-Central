import { Router, type Response } from 'express';
import {
  InvoiceStatus,
  PatientConsentScope,
  PatientConsentStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { z } from 'zod';
import { requirePatientAuth, type PatientAuthRequest } from '../../middleware/patientAuth.js';
import { logPatientAccess } from '../../services/patientAccessLog.js';

const prisma = new PrismaClient();
const router = Router();

type BillingAccess = {
  clinicId: string;
  clinicName: string;
  patientIds: Set<string>;
};

type BillingAccessMap = Map<string, BillingAccess>;

function escapePdfText(value: string): string {
  return value.replace(/[\\()]/g, (match) => `\\${match}`);
}

function buildInvoiceConditions(accessMap: BillingAccessMap): Prisma.InvoiceWhereInput['OR'] {
  const conditions: Prisma.InvoiceWhereInput['OR'] = [];

  for (const access of accessMap.values()) {
    if (access.patientIds.size === 0) {
      continue;
    }

    conditions.push({
      tenantId: access.clinicId,
      patientId: { in: Array.from(access.patientIds) },
    });
  }

  return conditions.length > 0 ? conditions : undefined;
}

async function resolveBillingAccess(patient: PatientAuthRequest['patient']): Promise<BillingAccessMap> {
  const accessMap: BillingAccessMap = new Map();

  if (!patient) {
    return accessMap;
  }

  const links = await prisma.patientLink.findMany({
    where: { globalPatientId: patient.globalPatientId },
  });

  if (links.length === 0) {
    return accessMap;
  }

  const clinicIds = Array.from(new Set(links.map((link) => link.clinicId)));

  const clinics = await prisma.tenant.findMany({
    where: { tenantId: { in: clinicIds }, enabledForPatientPortal: true },
    select: { tenantId: true, name: true },
  });

  if (clinics.length === 0) {
    return accessMap;
  }

  const consents = await prisma.patientConsent.findMany({
    where: { globalPatientId: patient.globalPatientId, clinicId: { in: clinics.map((clinic) => clinic.tenantId) } },
  });

  const consentMap = new Map<string, PatientConsentStatus>();
  for (const consent of consents) {
    consentMap.set(`${consent.clinicId}:${consent.scope}`, consent.status);
  }

  for (const clinic of clinics) {
    const allStatus = consentMap.get(`${clinic.tenantId}:${PatientConsentScope.ALL}`);
    if (allStatus === PatientConsentStatus.REVOKED) {
      continue;
    }

    const billingStatus = consentMap.get(`${clinic.tenantId}:${PatientConsentScope.BILLING}`);
    if (billingStatus === PatientConsentStatus.REVOKED) {
      continue;
    }

    const clinicLinks = links.filter((link) => link.clinicId === clinic.tenantId);
    if (clinicLinks.length === 0) {
      continue;
    }

    accessMap.set(clinic.tenantId, {
      clinicId: clinic.tenantId,
      clinicName: clinic.name,
      patientIds: new Set(clinicLinks.map((link) => link.patientId)),
    });
  }

  return accessMap;
}

async function assertInvoiceAccess(
  invoiceId: string,
  patient: PatientAuthRequest['patient'],
): Promise<
  | (Prisma.InvoiceGetPayload<{
      include: {
        tenant: { select: { tenantId: true; name: true } };
      };
    }> & { amountDue: Prisma.Decimal })
  | null
> {
  const accessMap = await resolveBillingAccess(patient);
  if (accessMap.size === 0) {
    return null;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: { tenant: { select: { tenantId: true, name: true } } },
  });

  if (!invoice) {
    return null;
  }

  const clinicAccess = accessMap.get(invoice.tenantId);
  if (!clinicAccess || !clinicAccess.patientIds.has(invoice.patientId)) {
    return null;
  }

  return invoice;
}

function createInvoicePdf(invoice: {
  invoiceNo: string;
  tenant: { name: string } | null;
  currency: string;
  grandTotal: Prisma.Decimal;
  amountDue: Prisma.Decimal;
}): Buffer {
  const header = '%PDF-1.4\n';
  const title = escapePdfText(`Invoice ${invoice.invoiceNo}`);
  const clinicName = escapePdfText(invoice.tenant?.name ?? 'Clinic');
  const totalLine = escapePdfText(`Total: ${invoice.currency} ${invoice.grandTotal.toFixed(2)}`);
  const dueLine = escapePdfText(`Amount due: ${invoice.currency} ${invoice.amountDue.toFixed(2)}`);

  const content = [
    'BT',
    '/F1 18 Tf',
    '72 720 Td',
    `(${title}) Tj`,
    '0 -28 Td',
    `(${clinicName}) Tj`,
    '0 -28 Td',
    `(${totalLine}) Tj`,
    '0 -28 Td',
    `(${dueLine}) Tj`,
    'ET',
  ].join('\n');

  const contentLength = Buffer.byteLength(content, 'utf8');

  const objects = [
    '',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentLength} >>\nstream\n${content}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let body = '';
  const offsets = [0];
  let position = Buffer.byteLength(header, 'utf8');

  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = position;
    body += objects[i];
    position += Buffer.byteLength(objects[i], 'utf8');
  }

  const xrefPosition = position;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i += 1) {
    const offset = offsets[i] ?? 0;
    xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  const trailer = 'trailer\n<< /Size 6 /Root 1 0 R >>\n';
  const footer = `${trailer}startxref\n${xrefPosition}\n%%EOF`;

  const pdfString = header + body + xref + footer;
  return Buffer.from(pdfString, 'utf8');
}

router.use(requirePatientAuth);

router.get('/', async (req: PatientAuthRequest, res: Response) => {
  const accessMap = await resolveBillingAccess(req.patient);

  const conditions = buildInvoiceConditions(accessMap);
  if (!conditions) {
    return res.json({ invoices: [] });
  }

  const statusQuery = (req.query.status as string | undefined)?.toUpperCase();
  let statusFilter: InvoiceStatus[] | undefined;

  if (statusQuery === 'PAID') {
    statusFilter = [InvoiceStatus.PAID, InvoiceStatus.REFUNDED];
  } else if (statusQuery === 'UNPAID') {
    statusFilter = [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID];
  }

  const where: Prisma.InvoiceWhereInput = {
    OR: conditions,
    NOT: { status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.VOID] } },
  };

  if (statusFilter) {
    where.status = { in: statusFilter };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      tenant: { select: { tenantId: true, name: true } },
    },
    orderBy: [
      { createdAt: 'desc' },
      { invoiceId: 'desc' },
    ],
    take: 200,
  });

  const response = invoices.map((invoice) => ({
    id: invoice.invoiceId,
    number: invoice.invoiceNo,
    status: invoice.status,
    clinic: invoice.tenant ? { id: invoice.tenant.tenantId, name: invoice.tenant.name } : null,
    issuedAt: invoice.createdAt.toISOString(),
    visitId: invoice.visitId,
    amountDue: invoice.amountDue.toFixed(2),
    grandTotal: invoice.grandTotal.toFixed(2),
    amountPaid: invoice.amountPaid.toFixed(2),
    currency: invoice.currency,
    canPay:
      invoice.amountDue.greaterThan(0) &&
      ![InvoiceStatus.PAID, InvoiceStatus.REFUNDED, InvoiceStatus.VOID].includes(invoice.status),
  }));

  await Promise.all(
    response.map((invoice) =>
      logPatientAccess(prisma, {
        patientUserId: req.patient!.patientUserId,
        resourceType: 'invoice_summary',
        resourceId: invoice.id,
        clinicId: invoice.clinic?.id ?? null,
      }),
    ),
  );

  res.json({ invoices: response });
});

router.get('/:invoiceId.pdf', async (req: PatientAuthRequest, res: Response) => {
  const invoice = await assertInvoiceAccess(req.params.invoiceId, req.patient);

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  const pdf = createInvoicePdf(invoice);

  await logPatientAccess(prisma, {
    patientUserId: req.patient!.patientUserId,
    resourceType: 'invoice_pdf',
    resourceId: invoice.invoiceId,
    clinicId: invoice.tenant?.tenantId ?? null,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`);
  res.setHeader('Content-Length', pdf.length.toString());
  res.send(pdf);
});

const payInvoiceSchema = z.object({
  provider: z.enum(['stripe', 'localWallet']).default('stripe'),
});

router.post('/:invoiceId/pay', async (req: PatientAuthRequest, res: Response) => {
  const invoice = await assertInvoiceAccess(req.params.invoiceId, req.patient);

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (!invoice.amountDue.greaterThan(0)) {
    return res.status(400).json({ error: 'Invoice is already settled' });
  }

  const parsed = payInvoiceSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { provider } = parsed.data;
  const normalizedAmount = invoice.amountDue.toFixed(2);

  await logPatientAccess(prisma, {
    patientUserId: req.patient!.patientUserId,
    resourceType: 'invoice_payment_intent',
    resourceId: invoice.invoiceId,
    clinicId: invoice.tenant?.tenantId ?? null,
  });

  if (provider === 'stripe') {
    return res.json({
      invoiceId: invoice.invoiceId,
      provider,
      status: 'requires_action',
      amount: normalizedAmount,
      currency: invoice.currency,
      message: 'Stripe checkout integration is not yet available. This is a mock payment intent.',
      redirectUrl: `https://example-payments.local/checkout?invoice=${invoice.invoiceId}`,
    });
  }

  const reference = `LOCAL-${Date.now().toString(36).toUpperCase()}`;

  return res.json({
    invoiceId: invoice.invoiceId,
    provider,
    status: 'pending',
    amount: normalizedAmount,
    currency: invoice.currency,
    message: 'Local wallet payment simulation created successfully.',
    reference,
  });
});

export default router;
