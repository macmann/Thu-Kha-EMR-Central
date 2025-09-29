-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');
CREATE TYPE "Role" AS ENUM ('Doctor', 'Admin', 'Auditor');

-- CreateTable
CREATE TABLE "Patient" (
    "patientId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "dob" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "contact" TEXT,
    "insurance" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Patient_pkey" PRIMARY KEY ("patientId")
);

CREATE TABLE "Doctor" (
    "doctorId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("doctorId")
);

CREATE TABLE "Visit" (
    "visitId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "visitDate" DATE NOT NULL,
    "doctorId" UUID NOT NULL,
    "department" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Visit_pkey" PRIMARY KEY ("visitId"),
    CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("doctorId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Diagnosis" (
    "diagId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visitId" UUID NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("diagId"),
    CONSTRAINT "Diagnosis_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("visitId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Medication" (
    "medId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visitId" UUID NOT NULL,
    "drugName" TEXT NOT NULL,
    "dosage" TEXT,
    "instructions" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Medication_pkey" PRIMARY KEY ("medId"),
    CONSTRAINT "Medication_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("visitId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "LabResult" (
    "labId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visitId" UUID NOT NULL,
    "testName" TEXT NOT NULL,
    "resultValue" DOUBLE PRECISION,
    "unit" TEXT,
    "referenceRange" TEXT,
    "testDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("labId"),
    CONSTRAINT "LabResult_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("visitId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Observation" (
    "obsId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visitId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "noteText" TEXT NOT NULL,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "heartRate" INTEGER,
    "temperatureC" DOUBLE PRECISION,
    "spo2" INTEGER,
    "bmi" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Observation_pkey" PRIMARY KEY ("obsId"),
    CONSTRAINT "Observation_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("visitId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Observation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Observation_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("doctorId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "User" (
    "userId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Session" (
    "sessionId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "ip" TEXT,
    "ua" TEXT,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionId"),
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AuthAudit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "event" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "meta" JSONB,
    "ts" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE INDEX "Visit_patientId_visitDate_idx" ON "Visit"("patientId", "visitDate" DESC);
CREATE INDEX "Visit_doctorId_visitDate_idx" ON "Visit"("doctorId", "visitDate" DESC);
CREATE INDEX "Observation_patientId_doctorId_createdAt_idx" ON "Observation"("patientId", "doctorId", "createdAt" DESC);
