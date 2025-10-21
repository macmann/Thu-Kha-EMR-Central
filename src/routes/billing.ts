import { Router, type NextFunction, type Response } from 'express';
import { InvoiceStatus, PrismaClient, type Prisma } from '@prisma/client';
import { z } from 'zod';

import { requireAuth, requireRole, type AuthRequest } from '../modules/auth/index.js';
import { validate } from '../middleware/validate.js';
import { resolveTenant } from '../middleware/tenant.js';
import {
  AddInvoiceItemSchema,
  CreateInvoiceSchema,
  DecimalString,
  PostPaymentSchema,
  UpdateInvoiceItemSchema,
  VoidInvoiceSchema,
  type CreateInvoiceInput,
  type InvoiceItemInput,
} from '../validation/billing.js';
import {
  addInvoiceItem,
  createInvoice,
  postPayment,
  removeInvoiceItem,
  updateInvoiceAdjustments,
  updateInvoiceItem,
  voidInvoice,
} from '../services/billingService.js';
import { NotFoundError } from '../utils/httpErrors.js';
import { postPharmacyCharges } from '../services/billingService.js';

const prisma = new PrismaClient();
const router = Router();

type ReceiptFormat = 'b5' | 'thermal';

const receiptStylesheets: Record<ReceiptFormat, readonly string[]> = {
  b5: ['/assets/receipts/receipt.base.css', '/assets/receipts/receipt.b5.css'],
  thermal: ['/assets/receipts/receipt.base.css', '/assets/receipts/receipt.thermal.css'],
};

function escapeHtml(value: unknown) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMultilineText(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, '<br />');
}

function formatCurrencyValue(value: unknown, currency: string) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }

  let raw = '';
  if (typeof value === 'number' || typeof value === 'bigint') {
    raw = value.toString();
  } else if (typeof value === 'string') {
    raw = value;
  } else if (typeof value === 'object' && value !== null && 'toString' in value) {
    raw = String((value as { toString: () => string }).toString());
  }

  if (!raw) {
    return '';
  }

  const numeric = Number.parseFloat(raw);
  if (!Number.isFinite(numeric)) {
    return escapeHtml(raw);
  }

  try {
    return escapeHtml(
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numeric),
    );
  } catch {
    return escapeHtml(numeric.toFixed(2));
  }
}

function getReceiptStylesheets(format: ReceiptFormat) {
  return receiptStylesheets[format] ?? receiptStylesheets.b5;
}

const ModifyInvoiceItemsSchema = z
  .object({
    add: z.array(AddInvoiceItemSchema).optional(),
    update: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          patch: UpdateInvoiceItemSchema,
        }),
      )
      .optional(),
    invoiceDiscountAmt: DecimalString.optional(),
    invoiceTaxAmt: DecimalString.optional(),
  })
  .refine(
    (data) =>
      Boolean(data.add?.length) ||
      Boolean(data.update?.length) ||
      typeof data.invoiceDiscountAmt !== 'undefined' ||
      typeof data.invoiceTaxAmt !== 'undefined',
    { message: 'No changes supplied' },
  );

const ListInvoicesQuerySchema = z.object({
  visitId: z.string().uuid().optional(),
  status: z
    .string()
    .optional()
    .transform((value) =>
      value
        ?.split(',')
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean) ?? [],
    ),
});

router.use(requireAuth);
router.use(resolveTenant);

router.post(
  '/billing/invoices',
  requireRole('Cashier', 'ITAdmin', 'Doctor', 'Pharmacist'),
  validate({ body: CreateInvoiceSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const payload = req.body as CreateInvoiceInput;
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const invoice = await createInvoice(tenantId, payload);
      res.status(201).json(invoice);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/billing/invoices',
  requireRole('Cashier', 'ITAdmin', 'Doctor', 'Pharmacist'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = ListInvoicesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { visitId, status } = parsed.data;
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const where: Prisma.InvoiceWhereInput = { tenantId };
      if (visitId) {
        where.visitId = visitId;
      }
      if (status && status.length) {
        const allowed = status.filter((value): value is InvoiceStatus =>
          (Object.values(InvoiceStatus) as string[]).includes(value),
        );
        if (allowed.length) {
          where.status = { in: allowed };
        }
      }
      const invoices = await prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          Patient: true,
        },
      });
      res.json({ data: invoices });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/billing/invoices/:invoiceId',
  requireRole('Cashier', 'ITAdmin', 'Doctor', 'Pharmacist'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const invoice = await prisma.invoice.findFirst({
        where: { invoiceId: req.params.invoiceId, tenantId },
        include: {
          items: true,
          payments: { include: { allocations: true } },
          Patient: true,
          Visit: true,
        },
      });
      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/billing/invoices/:invoiceId/items',
  requireRole('Cashier', 'ITAdmin'),
  validate({ body: ModifyInvoiceItemsSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const invoiceId = req.params.invoiceId;
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const body = req.body as z.infer<typeof ModifyInvoiceItemsSchema>;
      const results: unknown[] = [];
      if (body.add) {
        for (const item of body.add as InvoiceItemInput[]) {
          results.push(await addInvoiceItem(invoiceId, tenantId, item));
        }
      }
      if (body.update) {
        for (const entry of body.update) {
          results.push(await updateInvoiceItem(entry.itemId, entry.patch));
        }
      }
      if (typeof body.invoiceDiscountAmt !== 'undefined' || typeof body.invoiceTaxAmt !== 'undefined') {
        const invoice = await updateInvoiceAdjustments(
          invoiceId,
          body.invoiceDiscountAmt,
          body.invoiceTaxAmt,
        );
        results.push(invoice);
      }
      res.json({ updated: results.length ? results : null });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/billing/items/:itemId',
  requireRole('Cashier', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await removeInvoiceItem(req.params.itemId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/billing/invoices/:invoiceId/payments',
  requireRole('Cashier', 'ITAdmin'),
  validate({ body: PostPaymentSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { amount, method, referenceNo, note } = req.body as z.infer<typeof PostPaymentSchema>;
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const payment = await postPayment(
        req.params.invoiceId,
        tenantId,
        amount,
        method,
        referenceNo,
        note,
      );
      res.status(201).json(payment);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/billing/invoices/:invoiceId/void',
  requireRole('Cashier', 'ITAdmin'),
  validate({ body: VoidInvoiceSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof VoidInvoiceSchema>;
      const invoice = await voidInvoice(req.params.invoiceId, body.reason);
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/billing/services',
  requireRole('ITAdmin', 'Cashier', 'Doctor', 'Pharmacist'),
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const services = await prisma.serviceCatalog.findMany({
        orderBy: { name: 'asc' },
      });
      res.json({ data: services });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/billing/services',
  requireRole('ITAdmin'),
  validate({
    body: z.object({
      code: z.string().trim().min(1),
      name: z.string().trim().min(1),
      defaultPrice: DecimalString,
      isActive: z.boolean().optional(),
    }),
  }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { code, name, defaultPrice, isActive = true } = req.body as {
        code: string;
        name: string;
        defaultPrice: string;
        isActive?: boolean;
      };
      const service = await prisma.serviceCatalog.create({
        data: {
          code,
          name,
          defaultPrice,
          isActive,
        },
      });
      res.status(201).json(service);
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/billing/services/:serviceId',
  requireRole('ITAdmin'),
  validate({
    body: z.object({
      name: z.string().trim().min(1),
      defaultPrice: DecimalString,
      isActive: z.boolean().optional(),
    }),
  }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { name: string; defaultPrice: string; isActive?: boolean };
      const updated = await prisma.serviceCatalog.update({
        where: { serviceId: req.params.serviceId },
        data: {
          name: body.name,
          defaultPrice: body.defaultPrice,
          isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        },
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/billing/services/:serviceId',
  requireRole('ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await prisma.serviceCatalog.delete({ where: { serviceId: req.params.serviceId } });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/billing/post-pharmacy/:prescriptionId',
  requireRole('Pharmacist', 'PharmacyTech', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const invoice = await postPharmacyCharges(req.params.prescriptionId);
      res.json({ invoiceId: invoice?.invoiceId ?? null });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/billing/invoices/:invoiceId/receipt',
  requireRole('Cashier', 'ITAdmin', 'Doctor', 'Pharmacist'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const requestedFormat =
        typeof req.query.format === 'string' ? req.query.format.toLowerCase() : 'b5';
      const format: ReceiptFormat = requestedFormat === 'thermal' ? 'thermal' : 'b5';
      const invoice = await prisma.invoice.findUnique({
        where: { invoiceId: req.params.invoiceId },
        include: {
          items: true,
          Patient: true,
          Visit: true,
          tenant: true,
        },
      });
      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }
      const configuration = await prisma.tenantConfiguration.findUnique({
        where: { tenantId: invoice.tenantId },
      });
      const createdAt = new Date(invoice.createdAt);
      const visitDate = invoice.Visit?.visitDate
        ? new Date(invoice.Visit.visitDate)
        : createdAt;
      const invoiceDate = createdAt.toLocaleString('en-GB', { timeZone: 'Asia/Yangon' });
      const visitDateDisplay = visitDate.toLocaleString('en-GB', { timeZone: 'Asia/Yangon' });
      const patientName = escapeHtml(invoice.Patient?.name ?? 'Unknown patient');
      const invoiceNumber = escapeHtml(invoice.invoiceNo);
      const currency = invoice.currency ?? 'MMK';
      const clinicNameRaw = configuration?.appName ?? invoice.tenant?.name ?? 'Clinic';
      const clinicName = escapeHtml(clinicNameRaw);
      const headerLogoHtml = configuration?.logo
        ? `<div class="receipt__header-logo"><img src="${configuration.logo}" alt="${clinicName} logo" /></div>`
        : '';
      const contactLines: string[] = [];
      if (configuration?.contactAddress) {
        contactLines.push(`<div class="receipt__header-contact">${formatMultilineText(configuration.contactAddress)}</div>`);
      }
      if (configuration?.contactPhone) {
        contactLines.push(`<div class="receipt__header-contact">${escapeHtml(configuration.contactPhone)}</div>`);
      }
      const headerDetails = `
        <div class="receipt__header-details">
          <div class="receipt__header-name">${clinicName}</div>
          ${contactLines.join('')}
        </div>
      `;
      const headerHtml = `
        <header class="receipt__header">
          ${headerLogoHtml}
          ${headerDetails}
        </header>
      `;
      const receiptClass = format === 'thermal' ? 'receipt receipt--thermal' : 'receipt receipt--b5';
      const itemRows = invoice.items.length
        ? invoice.items
            .map(
              (item) => `
            <tr>
              <td>${escapeHtml(item.description)}</td>
              <td>${escapeHtml(item.quantity)}</td>
              <td>${formatCurrencyValue(item.unitPrice, currency)}</td>
              <td>${formatCurrencyValue(item.lineTotal, currency)}</td>
            </tr>`,
            )
            .join('')
        : '<tr class="receipt__empty"><td colspan="4">No line items recorded.</td></tr>';
      const totals = [
        { label: 'Subtotal', value: formatCurrencyValue(invoice.subTotal, currency) },
        { label: 'Discount', value: formatCurrencyValue(invoice.discountAmt, currency) },
        { label: 'Tax', value: formatCurrencyValue(invoice.taxAmt, currency) },
        { label: 'Grand total', value: formatCurrencyValue(invoice.grandTotal, currency) },
        { label: 'Amount paid', value: formatCurrencyValue(invoice.amountPaid, currency) },
        { label: 'Amount due', value: formatCurrencyValue(invoice.amountDue, currency) },
      ];
      const totalsRows = totals
        .map(
          (row) => `
        <tr>
          <td colspan="3">${escapeHtml(row.label)}</td>
          <td>${row.value}</td>
        </tr>`,
        )
        .join('');
      const noteHtml = invoice.note
        ? `<p class="receipt__notes receipt__notes--detail"><strong>Note:</strong> ${escapeHtml(
            invoice.note,
          )}</p>`
        : '';
      const stylesheetLinks = getReceiptStylesheets(format)
        .map((href) => `<link rel="stylesheet" href="${href}" />`)
        .join('');

      const receiptHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${invoiceNumber}</title>
    ${stylesheetLinks}
  </head>
  <body>
    <main class="${receiptClass}">
      ${headerHtml}
      <h1 class="receipt__title">Invoice ${invoiceNumber}</h1>
      <dl class="receipt__meta">
        <div>
          <dt>Patient</dt>
          <dd>${patientName}</dd>
        </div>
        <div>
          <dt>Invoice number</dt>
          <dd>${invoiceNumber}</dd>
        </div>
        <div>
          <dt>Visit date</dt>
          <dd>${escapeHtml(visitDateDisplay)}</dd>
        </div>
        <div>
          <dt>Invoice date</dt>
          <dd>${escapeHtml(invoiceDate)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>${escapeHtml(invoice.status)}</dd>
        </div>
        <div>
          <dt>Currency</dt>
          <dd>${escapeHtml(currency)}</dd>
        </div>
      </dl>
      <table class="receipt__table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        <tfoot>
          ${totalsRows}
        </tfoot>
      </table>
      ${noteHtml}
      <p class="receipt__notes">Thank you for your visit!</p>
    </main>
  </body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(receiptHtml);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
