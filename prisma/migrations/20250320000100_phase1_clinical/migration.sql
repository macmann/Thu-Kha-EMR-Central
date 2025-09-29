-- Extend role enum for clinical staff
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'Nurse';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'LabTech';

-- Rename legacy lab results table
ALTER TABLE "LabResult" RENAME TO "VisitLabResult";
ALTER TABLE "VisitLabResult" RENAME CONSTRAINT "LabResult_pkey" TO "VisitLabResult_pkey";
ALTER TABLE "VisitLabResult" RENAME CONSTRAINT "LabResult_visitId_fkey" TO "VisitLabResult_visitId_fkey";

-- Ensure dependent indexes use new name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'LabResult_visitId_idx'
  ) THEN
    EXECUTE 'ALTER INDEX "LabResult_visitId_idx" RENAME TO "VisitLabResult_visitId_idx"';
  END IF;
END $$;

-- New enums for problem list and laboratory workflows
DO $$ BEGIN
  CREATE TYPE "ProblemStatus" AS ENUM ('ACTIVE', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LabOrderStatus" AS ENUM ('ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LabItemStatus" AS ENUM ('ORDERED', 'RESULTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Vitals capture table
CREATE TABLE IF NOT EXISTS "Vitals" (
  "vitalsId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "visitId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "recordedBy" UUID NOT NULL,
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "systolic" INTEGER,
  "diastolic" INTEGER,
  "heartRate" INTEGER,
  "temperature" NUMERIC(4,1),
  "spo2" INTEGER,
  "heightCm" NUMERIC(5,2),
  "weightKg" NUMERIC(5,2),
  "bmi" NUMERIC(5,2),
  "notes" TEXT
);

CREATE INDEX IF NOT EXISTS "Vitals_visitId_idx" ON "Vitals" ("visitId");
CREATE INDEX IF NOT EXISTS "Vitals_patientId_recordedAt_idx" ON "Vitals" ("patientId", "recordedAt");

ALTER TABLE "Vitals"
  ADD CONSTRAINT "Vitals_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("visitId") ON DELETE CASCADE;
ALTER TABLE "Vitals"
  ADD CONSTRAINT "Vitals_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("patientId") ON DELETE CASCADE;
ALTER TABLE "Vitals"
  ADD CONSTRAINT "Vitals_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User" ("userId") ON DELETE RESTRICT;

-- Problem list
CREATE TABLE IF NOT EXISTS "Problem" (
  "problemId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "patientId" UUID NOT NULL,
  "codeSystem" TEXT,
  "code" TEXT,
  "display" TEXT NOT NULL,
  "onsetDate" TIMESTAMPTZ,
  "status" "ProblemStatus" NOT NULL DEFAULT 'ACTIVE',
  "resolvedDate" TIMESTAMPTZ,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Problem_patientId_status_idx" ON "Problem" ("patientId", "status");

ALTER TABLE "Problem"
  ADD CONSTRAINT "Problem_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("patientId") ON DELETE CASCADE;
ALTER TABLE "Problem"
  ADD CONSTRAINT "Problem_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("userId") ON DELETE RESTRICT;

-- Computerized provider order entry for labs
CREATE TABLE IF NOT EXISTS "LabOrder" (
  "labOrderId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "visitId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "doctorId" UUID NOT NULL,
  "status" "LabOrderStatus" NOT NULL DEFAULT 'ORDERED',
  "priority" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "LabOrder_visitId_status_idx" ON "LabOrder" ("visitId", "status");
CREATE INDEX IF NOT EXISTS "LabOrder_patientId_status_idx" ON "LabOrder" ("patientId", "status");

ALTER TABLE "LabOrder"
  ADD CONSTRAINT "LabOrder_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("visitId") ON DELETE CASCADE;
ALTER TABLE "LabOrder"
  ADD CONSTRAINT "LabOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("patientId") ON DELETE CASCADE;
ALTER TABLE "LabOrder"
  ADD CONSTRAINT "LabOrder_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("doctorId") ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS "LabOrderItem" (
  "labOrderItemId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "labOrderId" UUID NOT NULL,
  "testCode" TEXT NOT NULL,
  "testName" TEXT NOT NULL,
  "status" "LabItemStatus" NOT NULL DEFAULT 'ORDERED',
  "specimen" TEXT,
  "notes" TEXT
);

CREATE INDEX IF NOT EXISTS "LabOrderItem_labOrderId_status_idx" ON "LabOrderItem" ("labOrderId", "status");

ALTER TABLE "LabOrderItem"
  ADD CONSTRAINT "LabOrderItem_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "LabOrder" ("labOrderId") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "LabResult" (
  "labResultId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "labOrderId" UUID NOT NULL,
  "labOrderItemId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "resultValue" TEXT,
  "resultValueNum" NUMERIC(10,3),
  "unit" TEXT,
  "referenceLow" NUMERIC(10,3),
  "referenceHigh" NUMERIC(10,3),
  "abnormalFlag" TEXT,
  "resultedBy" UUID NOT NULL,
  "resultedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "notes" TEXT
);

CREATE INDEX IF NOT EXISTS "LabResult_labOrderId_idx" ON "LabResult" ("labOrderId");
CREATE INDEX IF NOT EXISTS "LabResult_labOrderItemId_idx" ON "LabResult" ("labOrderItemId");
CREATE INDEX IF NOT EXISTS "LabResult_patientId_resultedAt_idx" ON "LabResult" ("patientId", "resultedAt");

ALTER TABLE "LabResult"
  ADD CONSTRAINT "LabResult_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "LabOrder" ("labOrderId") ON DELETE CASCADE;
ALTER TABLE "LabResult"
  ADD CONSTRAINT "LabResult_labOrderItemId_fkey" FOREIGN KEY ("labOrderItemId") REFERENCES "LabOrderItem" ("labOrderItemId") ON DELETE CASCADE;
ALTER TABLE "LabResult"
  ADD CONSTRAINT "LabResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("patientId") ON DELETE CASCADE;
ALTER TABLE "LabResult"
  ADD CONSTRAINT "LabResult_resultedBy_fkey" FOREIGN KEY ("resultedBy") REFERENCES "User" ("userId") ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS "LabCatalog" (
  "testCode" TEXT PRIMARY KEY,
  "testName" TEXT NOT NULL,
  "unit" TEXT,
  "refLow" NUMERIC(10,3),
  "refHigh" NUMERIC(10,3),
  "panel" BOOLEAN NOT NULL DEFAULT false
);
