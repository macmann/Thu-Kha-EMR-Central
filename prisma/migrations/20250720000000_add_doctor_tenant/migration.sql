-- Add tenant linkage to doctors to scope them to clinics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Doctor' AND column_name = 'tenantId'
  ) THEN
    ALTER TABLE "Doctor" ADD COLUMN "tenantId" UUID;
  END IF;
END $$;

-- Ensure the default tenant exists and backfill missing tenantIds
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

  UPDATE "Doctor" d
  SET "tenantId" = COALESCE(d."tenantId", default_tenant)
  WHERE d."tenantId" IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM "Tenant" t WHERE t."tenantId" = d."tenantId"
     );
END $$;

-- Add foreign key and supporting index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Doctor_tenantId_fkey'
  ) THEN
    ALTER TABLE "Doctor"
      ADD CONSTRAINT "Doctor_tenantId_fkey"
      FOREIGN KEY ("tenantId")
      REFERENCES "Tenant"("tenantId")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Doctor_tenantId_idx" ON "Doctor"("tenantId");
