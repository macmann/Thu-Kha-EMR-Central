-- Alter enum values for Role and introduce AdminAssistant / ITAdmin
CREATE TYPE "Role_new" AS ENUM ('Doctor', 'AdminAssistant', 'ITAdmin');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE
      WHEN "role"::text = 'Admin' THEN 'ITAdmin'::"Role_new"
      WHEN "role"::text = 'Auditor' THEN 'AdminAssistant'::"Role_new"
      ELSE "role"::text::"Role_new"
    END
  );

ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

-- Add doctor linkage to users for clinician accounts
ALTER TABLE "User"
  ADD COLUMN "doctorId" UUID;

ALTER TABLE "User"
  ADD CONSTRAINT "User_doctorId_fkey" FOREIGN KEY ("doctorId")
  REFERENCES "Doctor"("doctorId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "User_doctorId_key" ON "User"("doctorId");
