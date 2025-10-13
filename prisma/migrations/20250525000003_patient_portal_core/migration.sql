-- Core patient portal data structures

-- Ensure enums exist for notification workflows
DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL', 'INAPP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('APPT_BOOKED', 'APPT_REMINDER', 'FOLLOWUP_DUE', 'INVOICE_DUE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Global patient profile shared across clinics
CREATE TABLE IF NOT EXISTS "GlobalPatient" (
  "id" TEXT NOT NULL,
  "primaryPhone" TEXT,
  "fullName" TEXT,
  "dob" TIMESTAMPTZ,
  "gender" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GlobalPatient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GlobalPatient_primaryPhone_key" UNIQUE ("primaryPhone")
);

-- Patient portal user accounts
CREATE TABLE IF NOT EXISTS "PatientUser" (
  "id" TEXT NOT NULL,
  "globalPatientId" TEXT NOT NULL,
  "loginPhone" TEXT,
  "loginEmail" TEXT,
  "lastLoginAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientUser_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PatientUser_loginPhone_key" UNIQUE ("loginPhone"),
  CONSTRAINT "PatientUser_loginEmail_key" UNIQUE ("loginEmail"),
  CONSTRAINT "PatientUser_globalPatientId_fkey" FOREIGN KEY ("globalPatientId") REFERENCES "GlobalPatient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Links between patient portal identities and clinic charts
CREATE TABLE IF NOT EXISTS "PatientLink" (
  "id" TEXT NOT NULL,
  "globalPatientId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "verifiedAt" TIMESTAMPTZ,
  CONSTRAINT "PatientLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PatientLink_clinicId_patientId_key" UNIQUE ("clinicId", "patientId"),
  CONSTRAINT "PatientLink_globalPatientId_fkey" FOREIGN KEY ("globalPatientId") REFERENCES "GlobalPatient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PatientLink_globalPatientId_idx" ON "PatientLink" ("globalPatientId");

-- OTP tracking for patient logins
CREATE TABLE IF NOT EXISTS "PatientOtp" (
  "id" TEXT NOT NULL,
  "contact" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "requestIp" TEXT,
  "deviceId" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMPTZ,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PatientOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PatientOtp_contact_idx" ON "PatientOtp" ("contact");
CREATE INDEX IF NOT EXISTS "PatientOtp_createdAt_idx" ON "PatientOtp" ("createdAt");

-- Notification delivery tracking
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "patientUserId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'INAPP',
  "type" "NotificationType" NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "PatientUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Notification_patientUserId_createdAt_idx" ON "Notification" ("patientUserId", "createdAt" DESC);

-- Patient portal access audit log
CREATE TABLE IF NOT EXISTS "PatientAccessLog" (
  "id" TEXT NOT NULL,
  "patientUserId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "clinicId" TEXT,
  "ts" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PatientAccessLog_patientUserId_ts_idx" ON "PatientAccessLog" ("patientUserId", "ts");
CREATE INDEX IF NOT EXISTS "PatientAccessLog_clinicId_ts_idx" ON "PatientAccessLog" ("clinicId", "ts");
