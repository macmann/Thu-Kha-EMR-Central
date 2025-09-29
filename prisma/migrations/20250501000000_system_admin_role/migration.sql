-- Add new SystemAdmin role for elevated tenant configuration access
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SystemAdmin';

-- Core tenancy tables
CREATE TABLE IF NOT EXISTS "Tenant" (
  "tenantId" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "code" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "Tenant_code_key" UNIQUE ("code")
);

CREATE TABLE IF NOT EXISTS "TenantConfiguration" (
  "tenantId" UUID NOT NULL,
  "appName" TEXT NOT NULL DEFAULT 'EMR System',
  "logo" TEXT,
  "widgetEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantConfiguration_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "TenantConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserTenant" (
  "userTenantId" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserTenant_pkey" PRIMARY KEY ("userTenantId"),
  CONSTRAINT "UserTenant_tenantId_userId_key" UNIQUE ("tenantId", "userId"),
  CONSTRAINT "UserTenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserTenant_userId_idx" ON "UserTenant" ("userId");
CREATE INDEX IF NOT EXISTS "UserTenant_tenantId_idx" ON "UserTenant" ("tenantId");

CREATE TABLE IF NOT EXISTS "PatientTenant" (
  "patientTenantId" UUID NOT NULL DEFAULT gen_random_uuid(),
  "patientId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "mrn" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientTenant_pkey" PRIMARY KEY ("patientTenantId"),
  CONSTRAINT "PatientTenant_tenantId_patientId_key" UNIQUE ("tenantId", "patientId"),
  CONSTRAINT "PatientTenant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PatientTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PatientTenant_patientId_idx" ON "PatientTenant" ("patientId");
CREATE INDEX IF NOT EXISTS "PatientTenant_tenantId_mrn_idx" ON "PatientTenant" ("tenantId", "mrn");

-- Add tenant linkage columns to operational tables
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "VisitLabResult" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Dispense" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "PaymentAllocation" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Vitals" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Problem" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "LabResult" ADD COLUMN IF NOT EXISTS "tenantId" UUID;

-- Seed a default tenant and backfill existing records
DO $$
DECLARE
  default_tenant UUID;
BEGIN
  INSERT INTO "Tenant" ("name", "code")
  VALUES ('Primary Clinic', 'default')
  ON CONFLICT ("code") DO UPDATE
    SET "name" = EXCLUDED."name",
        "updatedAt" = CURRENT_TIMESTAMP
  RETURNING "tenantId" INTO default_tenant;

  IF default_tenant IS NULL THEN
    SELECT "tenantId" INTO default_tenant FROM "Tenant" WHERE "code" = 'default' LIMIT 1;
  END IF;

  INSERT INTO "TenantConfiguration" ("tenantId", "appName", "widgetEnabled")
  VALUES (default_tenant, 'Primary Clinic', FALSE)
  ON CONFLICT ("tenantId") DO UPDATE
    SET "appName" = EXCLUDED."appName",
        "updatedAt" = CURRENT_TIMESTAMP;

  UPDATE "Appointment" a
  SET "tenantId" = default_tenant
  WHERE a."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = a."tenantId"
     );

  UPDATE "Visit" v
  SET "tenantId" = default_tenant
  WHERE v."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = v."tenantId"
     );

  UPDATE "VisitLabResult" vlr
  SET "tenantId" = default_tenant
  WHERE vlr."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = vlr."tenantId"
     );

  UPDATE "Prescription" pr
  SET "tenantId" = default_tenant
  WHERE pr."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = pr."tenantId"
     );

  UPDATE "Dispense" d
  SET "tenantId" = default_tenant
  WHERE d."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = d."tenantId"
     );

  UPDATE "StockItem" si
  SET "tenantId" = default_tenant
  WHERE si."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = si."tenantId"
     );

  UPDATE "Invoice" inv
  SET "tenantId" = default_tenant
  WHERE inv."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = inv."tenantId"
     );

  UPDATE "InvoiceItem" ii
  SET "tenantId" = default_tenant
  WHERE ii."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = ii."tenantId"
     );

  UPDATE "Payment" pay
  SET "tenantId" = default_tenant
  WHERE pay."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = pay."tenantId"
     );

  UPDATE "PaymentAllocation" pa
  SET "tenantId" = default_tenant
  WHERE pa."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = pa."tenantId"
     );

  UPDATE "Vitals" vt
  SET "tenantId" = default_tenant
  WHERE vt."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = vt."tenantId"
     );

  UPDATE "Problem" pb
  SET "tenantId" = default_tenant
  WHERE pb."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = pb."tenantId"
     );

  UPDATE "LabOrder" lo
  SET "tenantId" = default_tenant
  WHERE lo."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = lo."tenantId"
     );

  UPDATE "LabResult" lr
  SET "tenantId" = default_tenant
  WHERE lr."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = lr."tenantId"
     );

  INSERT INTO "UserTenant" ("userId", "tenantId", "role")
  SELECT u."userId", default_tenant, u."role"
  FROM "User" u
  ON CONFLICT ("tenantId", "userId") DO NOTHING;

  INSERT INTO "PatientTenant" ("patientId", "tenantId")
  SELECT p."patientId", default_tenant
  FROM "Patient" p
  ON CONFLICT ("tenantId", "patientId") DO NOTHING;
END
$$;

-- Ensure tenant references are required
ALTER TABLE "Appointment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Visit" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "VisitLabResult" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Prescription" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Dispense" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StockItem" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "InvoiceItem" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Vitals" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Problem" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "LabOrder" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "LabResult" ALTER COLUMN "tenantId" SET NOT NULL;

-- Foreign keys to Tenant for operational tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Appointment_tenantId_fkey') THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Visit_tenantId_fkey') THEN
    ALTER TABLE "Visit"
      ADD CONSTRAINT "Visit_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'VisitLabResult_tenantId_fkey') THEN
    ALTER TABLE "VisitLabResult"
      ADD CONSTRAINT "VisitLabResult_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Prescription_tenantId_fkey') THEN
    ALTER TABLE "Prescription"
      ADD CONSTRAINT "Prescription_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Dispense_tenantId_fkey') THEN
    ALTER TABLE "Dispense"
      ADD CONSTRAINT "Dispense_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'StockItem_tenantId_fkey') THEN
    ALTER TABLE "StockItem"
      ADD CONSTRAINT "StockItem_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Invoice_tenantId_fkey') THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InvoiceItem_tenantId_fkey') THEN
    ALTER TABLE "InvoiceItem"
      ADD CONSTRAINT "InvoiceItem_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Payment_tenantId_fkey') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PaymentAllocation_tenantId_fkey') THEN
    ALTER TABLE "PaymentAllocation"
      ADD CONSTRAINT "PaymentAllocation_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Vitals_tenantId_fkey') THEN
    ALTER TABLE "Vitals"
      ADD CONSTRAINT "Vitals_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Problem_tenantId_fkey') THEN
    ALTER TABLE "Problem"
      ADD CONSTRAINT "Problem_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LabOrder_tenantId_fkey') THEN
    ALTER TABLE "LabOrder"
      ADD CONSTRAINT "LabOrder_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LabResult_tenantId_fkey') THEN
    ALTER TABLE "LabResult"
      ADD CONSTRAINT "LabResult_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- Supporting indexes for tenant scoped queries
CREATE INDEX IF NOT EXISTS "Appointment_tenantId_date_idx" ON "Appointment" ("tenantId", "date");
CREATE INDEX IF NOT EXISTS "Visit_tenantId_visitDate_idx" ON "Visit" ("tenantId", "visitDate" DESC);
CREATE INDEX IF NOT EXISTS "VisitLabResult_tenantId_testDate_idx" ON "VisitLabResult" ("tenantId", "testDate");
CREATE INDEX IF NOT EXISTS "Prescription_tenantId_status_idx" ON "Prescription" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Dispense_tenantId_status_idx" ON "Dispense" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "StockItem_tenantId_location_idx" ON "StockItem" ("tenantId", "location");
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_status_idx" ON "Invoice" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "InvoiceItem_tenantId_sourceType_idx" ON "InvoiceItem" ("tenantId", "sourceType");
CREATE INDEX IF NOT EXISTS "Payment_tenantId_paidAt_idx" ON "Payment" ("tenantId", "paidAt");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_tenantId_paymentId_idx" ON "PaymentAllocation" ("tenantId", "paymentId");
CREATE INDEX IF NOT EXISTS "Vitals_tenantId_recordedAt_idx" ON "Vitals" ("tenantId", "recordedAt");
CREATE INDEX IF NOT EXISTS "Problem_tenantId_status_idx" ON "Problem" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "LabOrder_tenantId_status_idx" ON "LabOrder" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "LabResult_tenantId_resultedAt_idx" ON "LabResult" ("tenantId", "resultedAt");
