ALTER TABLE "PatientUser" ADD COLUMN "passwordHash" TEXT;
UPDATE "PatientUser" SET "passwordHash" = '$2b$10$GLA80VCsjk.DGuy6jTBQCOrwCsgYfTHGVepIVow74KT.NvJsVuo2G' WHERE "passwordHash" IS NULL;
ALTER TABLE "PatientUser" ALTER COLUMN "passwordHash" SET NOT NULL;
