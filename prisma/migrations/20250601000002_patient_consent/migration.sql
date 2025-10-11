-- CreateEnum
CREATE TYPE "PatientConsentScope" AS ENUM ('VISITS', 'LAB', 'MEDS', 'BILLING', 'ALL');

-- CreateEnum
CREATE TYPE "PatientConsentStatus" AS ENUM ('GRANTED', 'REVOKED');

-- CreateTable
CREATE TABLE "PatientConsent" (
    "id" TEXT NOT NULL,
    "globalPatientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "scope" "PatientConsentScope" NOT NULL,
    "status" "PatientConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientConsent_globalPatientId_clinicId_scope_key" ON "PatientConsent"("globalPatientId", "clinicId", "scope");

-- CreateIndex
CREATE INDEX "PatientConsent_globalPatientId_idx" ON "PatientConsent"("globalPatientId");

-- CreateIndex
CREATE INDEX "PatientConsent_clinicId_idx" ON "PatientConsent"("clinicId");

-- AddForeignKey
ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_globalPatientId_fkey" FOREIGN KEY ("globalPatientId") REFERENCES "GlobalPatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
