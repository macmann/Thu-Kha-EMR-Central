import { Router, type Response, type NextFunction } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../modules/auth/index.js';
import { validate } from '../middleware/validate.js';
import {
  CreateLabOrderSchema,
  CreateProblemSchema,
  CreateVitalsSchema,
  EnterLabResultSchema,
  UpdateProblemStatusSchema,
} from '../validation/clinical.js';
import * as vitals from '../services/vitalsService.js';
import * as problems from '../services/problemService.js';
import * as labs from '../services/labService.js';
import { resolveTenant } from '../middleware/tenant.js';

const router = Router();

// Vitals
router.post(
  '/vitals',
  requireAuth,
  resolveTenant,
  requireRole('Nurse', 'Doctor', 'ITAdmin'),
  validate({ body: CreateVitalsSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const data = await vitals.createVitals(user.userId, tenantId, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/patients/:patientId/vitals',
  requireAuth,
  resolveTenant,
  requireRole('Nurse', 'Doctor', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const data = await vitals.listVitals(
        req.params.patientId,
        tenantId,
        {
          limit: Number.isFinite(limit) ? limit : 50,
        },
      );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

// Problems
router.post(
  '/problems',
  requireAuth,
  resolveTenant,
  requireRole('Doctor', 'ITAdmin'),
  validate({ body: CreateProblemSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const data = await problems.addProblem(user.userId, tenantId, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/patients/:patientId/problems',
  requireAuth,
  resolveTenant,
  requireRole('Nurse', 'Doctor', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const data = await problems.listProblems(req.params.patientId, tenantId, statusParam);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/problems/:problemId/status',
  requireAuth,
  resolveTenant,
  requireRole('Doctor', 'ITAdmin'),
  validate({ body: UpdateProblemStatusSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const data = await problems.updateProblemStatus(
        req.params.problemId,
        tenantId,
        req.body.status,
        req.body.resolvedDate,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

// Lab Orders & Results
router.post(
  '/lab-orders',
  requireAuth,
  resolveTenant,
  requireRole('Doctor', 'ITAdmin'),
  validate({ body: CreateLabOrderSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const data = await labs.createLabOrder(user.userId, tenantId, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/lab-orders',
  requireAuth,
  resolveTenant,
  requireRole('LabTech', 'Doctor', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filters = {
        patientId: typeof req.query.patientId === 'string' && req.query.patientId.length > 0
          ? req.query.patientId
          : undefined,
        visitId: typeof req.query.visitId === 'string' && req.query.visitId.length > 0
          ? req.query.visitId
          : undefined,
        status: typeof req.query.status === 'string' && req.query.status.length > 0
          ? req.query.status
          : undefined,
      };
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const data = await labs.listLabOrders(filters, tenantId);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/lab-orders/:labOrderId',
  requireAuth,
  resolveTenant,
  requireRole('LabTech', 'Doctor', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const data = await labs.getLabOrderDetail(req.params.labOrderId, tenantId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/lab-results',
  requireAuth,
  resolveTenant,
  requireRole('LabTech', 'ITAdmin'),
  validate({ body: EnterLabResultSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await labs.enterLabResult(user.userId, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/lab-orders/:labOrderId/report.pdf',
  requireAuth,
  resolveTenant,
  requireRole('Doctor', 'LabTech', 'ITAdmin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const pdf = await labs.generateLabReportPdf(req.params.labOrderId);
      res.json({ ok: true, note: 'PDF generation stub', length: pdf.length });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
