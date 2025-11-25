import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import express, { NextFunction, Request, Response, Router } from 'express';
import crypto from 'node:crypto';
import helmet from 'helmet';
import type { IncomingMessage, ServerResponse } from 'http';
import cors from 'cors';
import morgan from 'morgan';
import { apiRouter } from './server.js';
import { docsRouter } from './docs/openapi.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter, { requireAuth } from './modules/auth/index.js';
import { resolveTenant } from './middleware/tenant.js';
import doctorsRouter from './modules/doctors/index.js';
import appointmentsRouter from './routes/appointments.js';

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

const isProduction = process.env.NODE_ENV === 'production';

type ContentSecurityPolicyDirectiveValueFunction = (
  req: IncomingMessage,
  res: ServerResponse,
) => string;

type ContentSecurityPolicyDirectiveValue =
  | string
  | ContentSecurityPolicyDirectiveValueFunction;

const nonceDirective: ContentSecurityPolicyDirectiveValueFunction = (
  _: IncomingMessage,
  res: ServerResponse,
) => {
  const response = res as Response;
  return `'nonce-${(response.locals.cspNonce as string | undefined) ?? ''}'`;
};

const scriptSrc: ContentSecurityPolicyDirectiveValue[] = ["'self'", nonceDirective];
if (!isProduction) {
  scriptSrc.push("'unsafe-eval'");
}

const styleSrc: ContentSecurityPolicyDirectiveValue[] = [
  "'self'",
  "'unsafe-inline'",
  'https://fonts.googleapis.com',
  nonceDirective,
];
const styleSrcElem: ContentSecurityPolicyDirectiveValue[] = [
  "'self'",
  "'unsafe-inline'",
  'https://fonts.googleapis.com',
];
const styleSrcAttr: ContentSecurityPolicyDirectiveValue[] = ["'unsafe-inline'"];

const connectSrc: ContentSecurityPolicyDirectiveValue[] = ["'self'", 'https:', 'ws:', 'wss:'];
if (!isProduction) {
  connectSrc.push('http://localhost:5173', 'ws://localhost:5173');
}

const imgSrc: ContentSecurityPolicyDirectiveValue[] = ["'self'", 'data:'];
const fontSrc: ContentSecurityPolicyDirectiveValue[] = [
  "'self'",
  'data:',
  'https://fonts.gstatic.com',
];
const frameSrc: ContentSecurityPolicyDirectiveValue[] = ["'self'", 'https://demo.atenxion.ai'];

app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        frameSrc,
        connectSrc,
        scriptSrc,
        styleSrc,
        styleSrcElem,
        styleSrcAttr,
        imgSrc,
        fontSrc,
        manifestSrc: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}

app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);

app.use('/api/docs', docsRouter);
app.use('/docs', docsRouter);

const tenantScopedPublicApi = Router({ mergeParams: true });
tenantScopedPublicApi.use(resolveTenant);
tenantScopedPublicApi.use('/doctors', doctorsRouter);
tenantScopedPublicApi.use('/appointments', appointmentsRouter);

const publicApi = Router({ mergeParams: true });
publicApi.use(resolveTenant);
publicApi.use('/doctors', doctorsRouter);
publicApi.use('/appointments', appointmentsRouter);
publicApi.use('/:tenantCode', tenantScopedPublicApi);

app.use('/api/:tenantCode', tenantScopedPublicApi);
app.use('/api', publicApi);

const protectedApi = Router();
protectedApi.use(requireAuth);
protectedApi.use(resolveTenant);
protectedApi.use(apiRouter);

app.use('/api', protectedApi);

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
const clientIndexPath = path.join(clientDir, 'index.html');
let cachedClientIndexHtml: string | undefined;

app.use(express.static(clientDir, { index: false }));
app.get('*', async (_req: Request, res: Response, nextMiddleware: NextFunction) => {
  if (!fs.existsSync(clientIndexPath)) {
    nextMiddleware();
    return;
  }

  try {
    if (!cachedClientIndexHtml || !isProduction) {
      cachedClientIndexHtml = await fsPromises.readFile(clientIndexPath, 'utf8');
    }

    const nonce = typeof res.locals.cspNonce === 'string' ? res.locals.cspNonce : '';
    const renderedHtml = cachedClientIndexHtml.replaceAll('%CSP_NONCE%', nonce);

    res.type('html').send(renderedHtml);
  } catch (error) {
    nextMiddleware(error);
  }
});

// Error handler should be last and only apply to /api routes
app.use('/api', errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
