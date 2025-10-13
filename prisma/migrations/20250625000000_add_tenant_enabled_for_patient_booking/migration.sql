-- Add the missing enabledForPatientBooking flag to tenants for patient portal booking toggle
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "enabledForPatientBooking" BOOLEAN NOT NULL DEFAULT false;

-- Ensure existing tenants have an explicit value for the new flag
UPDATE "Tenant"
SET "enabledForPatientBooking" = COALESCE("enabledForPatientBooking", false);
