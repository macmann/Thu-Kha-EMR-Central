import 'dotenv/config';
import path from 'path';
import fs from 'node:fs';
import express, { NextFunction, Request, Response, Router } from 'express';
import crypto from 'node:crypto';
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

app.use((req: Request, res: Response, nextMiddleware: NextFunction) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;
  res.locals.nonce = nonce;
  Object.assign(req.headers, { 'x-csp-nonce': nonce, 'x-nonce': nonce });
  res.setHeader('x-csp-nonce', nonce);
  res.setHeader('x-nonce', nonce);
  nextMiddleware();
});

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

const shouldEnablePatientPortal =
  process.env.ENABLE_PATIENT_PORTAL !== 'false' && process.env.NODE_ENV !== 'test';

app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
  })
);

app.use((req: Request, res: Response, nextMiddleware: NextFunction) => {
  const nonce = res.locals.cspNonce as string | undefined;

  const scriptSrcDirectives = ["'self'", nonce ? `'nonce-${nonce}'` : undefined];
  if (process.env.NODE_ENV !== 'production') {
    scriptSrcDirectives.push("'unsafe-eval'");
  }

  const styleSrcDirectives = ["'self'", nonce ? `'nonce-${nonce}'` : undefined];
  if (process.env.NODE_ENV !== 'production') {
    styleSrcDirectives.push("'unsafe-inline'");
  }

  const connectSrcDirectives = ["'self'", 'https:', 'wss:', 'ws:'];
  if (process.env.NODE_ENV !== 'production') {
    connectSrcDirectives.push('http://localhost:5173', 'ws://localhost:5173');
  }

  const imgSrcDirectives = ["'self'", 'data:', 'https:', 'blob:'];
  const fontSrcDirectives = ["'self'", 'data:'];

  const mapNonEmpty = (value: (string | undefined)[]) =>
    value.filter((entry): entry is string => Boolean(entry));

  return helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      frameSrc: ["'self'", 'https://demo.atenxion.ai'],
      connectSrc: connectSrcDirectives,
      scriptSrc: mapNonEmpty([...scriptSrcDirectives]),
      scriptSrcElem: mapNonEmpty([...scriptSrcDirectives]),
      styleSrc: mapNonEmpty([...styleSrcDirectives]),
      styleSrcElem: mapNonEmpty([...styleSrcDirectives]),
      imgSrc: imgSrcDirectives,
      fontSrc: fontSrcDirectives,
      manifestSrc: ["'self'"],
      formAction: ["'self'"],
    },
  })(req, res, nextMiddleware);
});

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

const publicDir = path.resolve(process.cwd(), 'public');
if (fs.existsSync(publicDir)) {
  const publicAssetsDir = path.join(publicDir, 'assets');
  if (fs.existsSync(publicAssetsDir)) {
    app.use('/assets', express.static(publicAssetsDir, { immutable: true, maxAge: '1y' }));
  }

  app.get('/manifest.webmanifest', (req: Request, res: Response, nextMiddleware: NextFunction) => {
    const manifestPath = path.join(publicDir, 'manifest.webmanifest');
    res.type('application/manifest+json');
    res.sendFile(manifestPath, (error: NodeJS.ErrnoException | undefined) => {
      if (error) {
        if ('code' in error && error.code === 'ENOENT') {
          res.status(404).end();
          return;
        }
        nextMiddleware(error);
      }
    });
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
    .catch((error: unknown) => {
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
