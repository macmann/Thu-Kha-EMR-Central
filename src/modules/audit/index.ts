import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthRequest } from '../auth/index.js';

const prisma = new PrismaClient();
const router = Router();

router.get('/', requireAuth, requireRole('ITAdmin'), async (req: AuthRequest, res: Response) => {
  const querySchema = z.object({
    entity: z.string().optional(),
    entity_id: z.string().optional(),
    actor: z.string().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { entity, entity_id, actor, from, to, limit = 20, offset = 0 } = parsed.data;
  const and: any[] = [];
  if (entity) and.push({ meta: { path: ['entity'], equals: entity } });
  if (entity_id) and.push({ meta: { path: ['entityId'], equals: entity_id } });
  if (actor) and.push({ meta: { path: ['actorUserId'], equals: actor } });
  if (from || to) {
    and.push({ ts: { ...(from && { gte: from }), ...(to && { lte: to }) } });
  }
  const audits = await prisma.authAudit.findMany({
    where: { event: 'data_change', ...(and.length ? { AND: and } : {}) },
    orderBy: { ts: 'desc' },
    take: limit,
    skip: offset,
  });
  res.json(audits);
});

export { logDataChange } from './service.js';
export default router;
