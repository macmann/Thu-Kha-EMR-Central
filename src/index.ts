import 'dotenv/config';
import path from 'path';
import express, { Request, Response, Router } from 'express';
import next from 'next/dist/server/next.js';
import type { NextServer, NextServerOptions } from 'next/dist/server/next.js';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { apiRouter } from './server.js';
import publicRouter from './modules/public/index.js';
import patientAuthRouter from './modules/patient-auth/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter, { requireAuth } from './modules/auth/index.js';
import { resolveTenant } from './middleware/tenant.js';
import patientConsentRouter from './modules/patient-consent/index.js';
import patientHistoryRouter, { docsRouter as patientDocsRouter } from './modules/patient-history/index.js';
import {
  clinicsRouter as patientClinicsRouter,
  appointmentsRouter as patientAppointmentsRouter,
} from './modules/patient-appointments/index.js';
import patientBillingRouter from './modules/patient-billing/index.js';
import patientNotificationsRouter from './modules/patient-notifications/index.js';
import { startAppointmentReminderCron } from './services/appointmentReminderCron.js';

if (
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('sslmode=require')
) {
  throw new Error('sslmode=require must be set in DATABASE_URL');
}

if (
  process.env.DIRECT_URL &&
  !process.env.DIRECT_URL.includes('sslmode=require')
) {
  throw new Error('sslmode=require must be set in DIRECT_URL');
}

export const app = express();
app.disable('x-powered-by');

const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  const normalizedTrustProxy =
    trustProxy === 'true'
      ? true
      : trustProxy === 'false'
        ? false
        : Number.isNaN(Number(trustProxy))
          ? trustProxy
          : Number(trustProxy);
  app.set('trust proxy', normalizedTrustProxy);
} else {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameSrc: ["'self'", 'https://demo.atenxion.ai'],
      },
    },
  })
);

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}

app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/public', publicRouter);

app.use('/api/auth', authRouter);
app.use('/api/patient/auth', patientAuthRouter);
app.use('/api/patient/consent', patientConsentRouter);
app.use('/api/patient/history', patientHistoryRouter);
app.use('/api/patient/docs', patientDocsRouter);
app.use('/api/patient/clinics', patientClinicsRouter);
app.use('/api/patient/appointments', patientAppointmentsRouter);
app.use('/api/patient/invoices', patientBillingRouter);
app.use('/api/patient/notifications', patientNotificationsRouter);

const protectedApi = Router();
protectedApi.use(requireAuth);
protectedApi.use(resolveTenant);
protectedApi.use(apiRouter);

app.use('/api', protectedApi);

const readinessPromises: Promise<void>[] = [];

const shouldEnablePatientPortal =
  process.env.ENABLE_PATIENT_PORTAL !== 'false' && process.env.NODE_ENV !== 'test';

const patientPortalWarmupRoutes = ['/patient/login'];

if (shouldEnablePatientPortal) {
  const patientPortalDir = path.resolve(process.cwd(), 'patient-portal');
  const createNextApp: (options: NextServerOptions) => NextServer = next;
  const patientPortalApp = createNextApp({
    dev: process.env.NODE_ENV !== 'production',
    dir: patientPortalDir,
  });

  const patientPortalHandler = patientPortalApp.getRequestHandler();
  const patientPortalReady = patientPortalApp.prepare();

  readinessPromises.push(
    patientPortalReady.catch((error: unknown) => {
      console.error('Failed to prepare patient portal', error);
      throw error;
    })
  );

  const patientPortalRoutes = ['/patient', '/patient/*', '/_next', '/_next/*'];

  app.all(patientPortalRoutes, async (req: Request, res: Response) => {
    await patientPortalReady;
    return patientPortalHandler(req, res);
  });
}

const clientDir = path.resolve(process.cwd(), 'dist_client');
app.use(express.static(clientDir));
app.get('*', (req: Request, res: Response) =>
  res.sendFile(path.join(clientDir, 'index.html'))
);

// Error handler should be last and only apply to /api routes
app.use('/api', errorHandler);

startAppointmentReminderCron();

if (process.env.NODE_ENV !== 'test') {
  Promise.all(readinessPromises)
    .catch((error) => {
      console.error('Server failed to start', error);
      process.exit(1);
    })
    .then(() => {
      const port = process.env.PORT || 8080;
      app.listen(port, () => {
        console.log(`Server listening on port ${port}`);

        if (shouldEnablePatientPortal) {
          void (async () => {
            for (const route of patientPortalWarmupRoutes) {
              try {
                const response = await fetch(`http://127.0.0.1:${port}${route}`, {
                  headers: { 'x-internal-warmup': 'true' },
                });
                await response.arrayBuffer();
                console.log(`Warmed patient portal route: ${route}`);
              } catch (error) {
                console.warn(`Failed to warm patient portal route: ${route}`, error);
              }
            }
          })();
        }
      });
    });
}
