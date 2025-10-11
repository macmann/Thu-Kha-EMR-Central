import 'dotenv/config';
import path from 'path';
import express, { Request, Response, Router } from 'express';
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

const protectedApi = Router();
protectedApi.use(requireAuth);
protectedApi.use(resolveTenant);
protectedApi.use(apiRouter);

app.use('/api', protectedApi);

const clientDir = path.resolve(process.cwd(), 'dist_client');
app.use(express.static(clientDir));
app.get('*', (req: Request, res: Response) =>
  res.sendFile(path.join(clientDir, 'index.html'))
);

// Error handler should be last and only apply to /api routes
app.use('/api', errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
