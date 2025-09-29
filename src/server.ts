import { Router } from 'express';

import visitsRouter from './modules/visits/index.js';
import patientsRouter from './modules/patients/index.js';
import doctorsRouter from './modules/doctors/index.js';
import diagnosesRouter from './modules/diagnoses/index.js';
import medicationsRouter from './modules/medications/index.js';
import labsRouter from './modules/labs/index.js';
import observationsRouter from './modules/observations/index.js';
import insightsRouter from './modules/insights/index.js';
import auditRouter from './modules/audit/index.js';
import { docsRouter } from './docs/openapi.js';
import authRouter from './modules/auth/index.js';
import appointmentsRouter from './routes/appointments.js';
import usersRouter from './modules/users/index.js';
import reportsRouter from './modules/reports/index.js';
import pharmacyRouter from './routes/pharmacy.js';
import billingRouter from './routes/billing.js';
import clinicalRouter from './routes/clinical.js';

export const apiRouter = Router();

apiRouter.use(visitsRouter);
apiRouter.use('/patients', patientsRouter);
apiRouter.use('/doctors', doctorsRouter);
apiRouter.use(diagnosesRouter);
apiRouter.use('/diagnoses', diagnosesRouter);
apiRouter.use(medicationsRouter);
apiRouter.use('/medications', medicationsRouter);
apiRouter.use(labsRouter);
apiRouter.use('/labs', labsRouter);
apiRouter.use(observationsRouter);
apiRouter.use('/insights', insightsRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/pharmacy', pharmacyRouter);
apiRouter.use(billingRouter);
apiRouter.use(clinicalRouter);
apiRouter.use(docsRouter);

export default apiRouter;
