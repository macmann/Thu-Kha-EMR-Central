-- Ensure the AppointmentStatus enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentStatus') THEN
    CREATE TYPE "AppointmentStatus" AS ENUM ('Scheduled', 'CheckedIn', 'InProgress', 'Completed', 'Cancelled');
  END IF;
END $$;

-- Create the Appointment table if it does not exist
CREATE TABLE IF NOT EXISTS "Appointment" (
  "appointmentId" UUID NOT NULL DEFAULT gen_random_uuid(),
  "patientId" UUID,
  "doctorId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "department" TEXT NOT NULL,
  "date" TIMESTAMPTZ(3) NOT NULL,
  "startTimeMin" INTEGER NOT NULL,
  "endTimeMin" INTEGER NOT NULL,
  "guestName" TEXT,
  "reason" TEXT,
  "location" TEXT,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'Scheduled',
  "cancelReason" TEXT,
  "reminder24SentAt" TIMESTAMPTZ(3),
  "reminder3SentAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("appointmentId")
);

-- Ensure required columns exist with correct types
ALTER TABLE "Appointment"
  ALTER COLUMN "patientId" DROP NOT NULL,
  ALTER COLUMN "date" TYPE TIMESTAMPTZ(3) USING "date"::timestamptz,
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt"::timestamptz,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt"::timestamptz,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Appointment' AND column_name = 'tenantId'
  ) THEN
    ALTER TABLE "Appointment" ADD COLUMN "tenantId" UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Appointment' AND column_name = 'guestName'
  ) THEN
    ALTER TABLE "Appointment" ADD COLUMN "guestName" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Appointment' AND column_name = 'reminder24SentAt'
  ) THEN
    ALTER TABLE "Appointment" ADD COLUMN "reminder24SentAt" TIMESTAMPTZ(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Appointment' AND column_name = 'reminder3SentAt'
  ) THEN
    ALTER TABLE "Appointment" ADD COLUMN "reminder3SentAt" TIMESTAMPTZ(3);
  END IF;
END $$;

-- Tenant linkage and required constraint
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

  UPDATE "Appointment" a
  SET "tenantId" = default_tenant
  WHERE a."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = a."tenantId"
     );
END $$;

ALTER TABLE "Appointment" ALTER COLUMN "tenantId" SET NOT NULL;

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Appointment_patientId_fkey'
  ) THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Appointment_doctorId_fkey'
  ) THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "Doctor"("doctorId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Appointment_tenantId_fkey'
  ) THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "Appointment_doctorId_date_startTimeMin_endTimeMin_idx"
  ON "Appointment" ("doctorId", "date", "startTimeMin", "endTimeMin");

CREATE INDEX IF NOT EXISTS "Appointment_patientId_date_idx"
  ON "Appointment" ("patientId", "date");

CREATE INDEX IF NOT EXISTS "Appointment_tenantId_date_idx"
  ON "Appointment" ("tenantId", "date");
