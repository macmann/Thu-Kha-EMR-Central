import { Router, type NextFunction, type Response } from 'express';
import multer from 'multer';
import { PrismaClient, PrescriptionStatus, type Prisma } from '@prisma/client';
import { z } from 'zod';

import { requireAuth, requireRole, type AuthRequest } from '../modules/auth/index.js';
import { validate } from '../middleware/validate.js';
import {
  AdjustStockSchema,
  CreateRxSchema,
  DispenseItemSchema,
  ReceiveStockSchema,
  type CreateRxInput,
  type DispenseItemInput,
} from '../validation/pharmacy.js';
import {
  addDispenseItem,
  adjustStock,
  completeDispense,
  createPrescription,
  getPharmacyQueue,
  listLowStockInventory,
  listStockItems,
  receiveStock,
  startDispense,
} from '../services/pharmacyService.js';
import { InvoiceScanError, scanInvoice as analyzeInvoice } from '../services/invoiceScanner.js';
import { postPharmacyCharges } from '../services/billingService.js';

const prisma = new PrismaClient();
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const CreateDrugSchema = z.object({
  drugId: z.string().uuid().optional(),
  name: z.string().min(1),
  genericName: z.string().optional(),
  form: z.string().min(1),
  strength: z.string().min(1),
  routeDefault: z.string().optional(),
  isActive: z.boolean().optional(),
});

const CompleteDispenseSchema = z.object({
  status: z.enum(['COMPLETED', 'PARTIAL']),
});

const SearchInventorySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().positive().max(50).optional(),
  includeAll: z.coerce.boolean().optional(),
});

const ListStockSchema = z.object({
  drugId: z.string().uuid(),
});

const LowStockQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
  threshold: z.coerce.number().int().nonnegative().optional(),
});

router.use(requireAuth);

router.post(
  '/drugs',
  requireRole('ITAdmin', 'InventoryManager'),
  validate({ body: CreateDrugSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof CreateDrugSchema>;
      const drug = await prisma.drug.create({ data: body });
      res.status(201).json(drug);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/inventory/receive',
  requireRole('ITAdmin', 'InventoryManager', 'Pharmacist'),
  validate({ body: ReceiveStockSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const payload = req.body as z.infer<typeof ReceiveStockSchema>;
      const created = await receiveStock(payload.items);
      res.status(201).json({ items: created });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/inventory/invoice/scan',
  requireRole('ITAdmin', 'InventoryManager', 'Pharmacist', 'PharmacyTech'),
  upload.single('invoice'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Invoice file is required.' });
      }
      const result = await analyzeInvoice(file.buffer, file.mimetype);
      res.json({ data: result });
    } catch (error) {
      if (error instanceof InvoiceScanError) {
        return res
          .status(error.statusCode ?? 502)
          .json({ error: error.message, details: error.details ?? null });
      }
      next(error);
    }
  },
);

router.get(
  '/inventory/stock',
  requireRole('Pharmacist', 'PharmacyTech', 'InventoryManager', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = ListStockSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const items = await listStockItems(parsed.data.drugId);
      res.json({ data: items });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/inventory/adjust',
  requireRole('ITAdmin', 'InventoryManager'),
  validate({ body: AdjustStockSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const payload = req.body as z.infer<typeof AdjustStockSchema>;
      const updated = await adjustStock(payload.adjustments);
      res.status(200).json({ items: updated });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/inventory/search',
  requireRole('Pharmacist', 'PharmacyTech', 'InventoryManager', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = SearchInventorySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const { q, limit = 10, includeAll = false } = parsed.data;

      const where: Prisma.DrugWhereInput = {
        isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { genericName: { contains: q, mode: 'insensitive' } },
          { strength: { contains: q, mode: 'insensitive' } },
        ],
      };

      if (!includeAll) {
        where.stocks = { some: { qtyOnHand: { gt: 0 } } };
      }

      const drugs = await prisma.drug.findMany({
        where,
        include: {
          stocks: {
            ...(includeAll ? {} : { where: { qtyOnHand: { gt: 0 } } }),
            select: { qtyOnHand: true },
          },
        },
        orderBy: [{ name: 'asc' }],
        take: limit,
      });

      const data = drugs.map((drug) => ({
        drugId: drug.drugId,
        name: drug.name,
        genericName: drug.genericName ?? null,
        strength: drug.strength,
        form: drug.form,
        routeDefault: drug.routeDefault ?? null,
        qtyOnHand: drug.stocks.reduce((total, stock) => total + stock.qtyOnHand, 0),
      }));

      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/inventory/low-stock',
  requireRole('InventoryManager', 'ITAdmin', 'Pharmacist'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = LowStockQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const { limit = 5, threshold = 10 } = parsed.data;
      const data = await listLowStockInventory(limit, threshold);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/visits/:visitId/prescriptions',
  requireRole('Doctor', 'Pharmacist'),
  validate({ body: CreateRxSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const visitId = req.params.visitId;
      const payload = req.body as CreateRxInput;

      const visit = await prisma.visit.findUnique({
        where: { visitId },
        select: { visitId: true, patientId: true, doctorId: true },
      });

      if (!visit) {
        return res.status(404).json({ error: 'Visit not found' });
      }

      if (req.user?.doctorId && req.user.doctorId !== visit.doctorId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const patientId = payload.patientId ?? visit.patientId;
      const { prescription, allergyHits } = await createPrescription(
        visitId,
        visit.doctorId,
        patientId,
        payload,
      );

      res.status(201).json({ prescription, allergyHits });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/prescriptions',
  requireRole('Pharmacist', 'PharmacyTech', 'InventoryManager', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const raw = typeof req.query.status === 'string' ? req.query.status.split(',') : undefined;
      const statuses = (raw ?? ['PENDING']).reduce((acc: PrescriptionStatus[], value: string) => {
        const normalized = value.trim().toUpperCase();
        if ((Object.values(PrescriptionStatus) as string[]).includes(normalized)) {
          acc.push(normalized as PrescriptionStatus);
        }
        return acc;
      }, []);

      const queue = await getPharmacyQueue(statuses.length ? statuses : [PrescriptionStatus.PENDING]);
      res.json({ data: queue });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/prescriptions/:prescriptionId/dispenses',
  requireRole('Pharmacist', 'PharmacyTech'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const dispense = await startDispense(req.params.prescriptionId, req.user.userId);
      res.status(201).json(dispense);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/dispenses/:dispenseId/items',
  requireRole('Pharmacist', 'PharmacyTech'),
  validate({ body: DispenseItemSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const payload = req.body as DispenseItemInput;
      const item = await addDispenseItem(req.params.dispenseId, payload);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/dispenses/:dispenseId/complete',
  requireRole('Pharmacist'),
  validate({ body: CompleteDispenseSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof CompleteDispenseSchema>;
      const result = await completeDispense(req.params.dispenseId, body.status);
      let invoiceId: string | null = null;
      if (body.status === 'COMPLETED') {
        const invoice = await postPharmacyCharges(result.prescriptionId);
        invoiceId = invoice?.invoiceId ?? null;
      }
      res.json({ ...result, invoiceId });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
