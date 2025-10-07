-- Add contact information fields to tenant configuration
ALTER TABLE "TenantConfiguration"
  ADD COLUMN IF NOT EXISTS "contactAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;

-- Ensure existing rows have null values explicitly set
UPDATE "TenantConfiguration"
SET "contactAddress" = "contactAddress",
    "contactPhone" = "contactPhone";
