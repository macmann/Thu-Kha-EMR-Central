import { Router, type Response } from 'express';
import { PrismaClient, type Notification } from '@prisma/client';
import { z } from 'zod';

import { requirePatientAuth, type PatientAuthRequest } from '../../middleware/patientAuth.js';

const prisma = new PrismaClient();
const notificationsRouter = Router();

notificationsRouter.use(requirePatientAuth);

const listQuerySchema = z.object({
  limit: z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number().int().positive().max(100))
    .optional(),
});

function serializeNotification(notification: Notification) {
  return {
    id: notification.id,
    channel: notification.channel,
    type: notification.type,
    status: notification.status,
    payload: notification.payload,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
  };
}

notificationsRouter.get('/', async (req: PatientAuthRequest, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }

  const limit = parsed.data.limit ?? 50;
  const patientUserId = req.patient!.patientUserId;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { patientUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where: { patientUserId, readAt: null } }),
  ]);

  res.json({
    notifications: notifications.map(serializeNotification),
    unreadCount,
  });
});

notificationsRouter.post('/read-all', async (req: PatientAuthRequest, res: Response) => {
  const patientUserId = req.patient!.patientUserId;
  const { count } = await prisma.notification.updateMany({
    where: { patientUserId, readAt: null },
    data: { readAt: new Date() },
  });

  res.json({ updated: count });
});

const notificationParamsSchema = z.object({ notificationId: z.string().uuid() });

notificationsRouter.post('/:notificationId/read', async (req: PatientAuthRequest, res: Response) => {
  const parsed = notificationParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid notificationId' });
  }

  const patientUserId = req.patient!.patientUserId;
  const existing = await prisma.notification.findFirst({
    where: { id: parsed.data.notificationId, patientUserId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  if (existing.readAt instanceof Date) {
    return res.json({ notification: serializeNotification(existing) });
  }

  const updated = await prisma.notification.update({
    where: { id: existing.id },
    data: { readAt: new Date() },
  });

  res.json({ notification: serializeNotification(updated) });
});

export default notificationsRouter;
