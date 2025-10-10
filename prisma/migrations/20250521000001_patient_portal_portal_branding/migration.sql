ALTER TABLE "Tenant"
  ADD COLUMN "enabledForPatientPortal" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "portalBranding" JSONB;
