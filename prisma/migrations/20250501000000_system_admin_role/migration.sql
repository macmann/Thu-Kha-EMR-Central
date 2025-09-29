-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SystemAdmin';

-- CreateTable
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

-- Seed existing tenants with configuration entries
INSERT INTO "TenantConfiguration" ("tenantId", "appName", "widgetEnabled")
SELECT "tenantId", "name", FALSE
FROM "Tenant"
WHERE NOT EXISTS (
  SELECT 1 FROM "TenantConfiguration" tc WHERE tc."tenantId" = "Tenant"."tenantId"
);
