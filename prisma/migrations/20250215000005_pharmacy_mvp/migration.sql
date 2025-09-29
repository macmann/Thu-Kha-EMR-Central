-- Extend Role enum for pharmacy workforce
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'Pharmacist';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PharmacyTech';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'InventoryManager';

-- New enums for prescription lifecycle
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'PARTIAL', 'DISPENSED', 'CANCELLED');
CREATE TYPE "DispenseStatus" AS ENUM ('READY', 'PARTIAL', 'COMPLETED', 'CANCELLED');

-- Core pharmacy reference data
CREATE TABLE "Drug" (
    "drugId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "form" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "routeDefault" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Drug_pkey" PRIMARY KEY ("drugId")
);

CREATE TABLE "StockItem" (
    "stockItemId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "drugId" UUID NOT NULL,
    "batchNo" TEXT,
    "expiryDate" TIMESTAMPTZ(3),
    "location" TEXT NOT NULL,
    "qtyOnHand" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10, 2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("stockItemId"),
    CONSTRAINT "StockItem_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("drugId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Prescription authoring
CREATE TABLE "Prescription" (
    "prescriptionId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visitId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("prescriptionId"),
    CONSTRAINT "Prescription_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("visitId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("doctorId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PrescriptionItem" (
    "itemId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prescriptionId" UUID NOT NULL,
    "drugId" UUID NOT NULL,
    "dose" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "quantityPrescribed" INTEGER NOT NULL,
    "prn" BOOLEAN NOT NULL DEFAULT FALSE,
    "allowGeneric" BOOLEAN NOT NULL DEFAULT TRUE,
    "notes" TEXT,
    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("itemId"),
    CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("prescriptionId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrescriptionItem_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("drugId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Dispensing workflow
CREATE TABLE "Dispense" (
    "dispenseId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prescriptionId" UUID NOT NULL,
    "pharmacistId" UUID NOT NULL,
    "status" "DispenseStatus" NOT NULL DEFAULT 'READY',
    "dispensedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dispense_pkey" PRIMARY KEY ("dispenseId"),
    CONSTRAINT "Dispense_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("prescriptionId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Dispense_pharmacistId_fkey" FOREIGN KEY ("pharmacistId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DispenseItem" (
    "dispenseItemId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dispenseId" UUID NOT NULL,
    "prescriptionItemId" UUID NOT NULL,
    "stockItemId" UUID,
    "drugId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10, 2),
    CONSTRAINT "DispenseItem_pkey" PRIMARY KEY ("dispenseItemId"),
    CONSTRAINT "DispenseItem_dispenseId_fkey" FOREIGN KEY ("dispenseId") REFERENCES "Dispense"("dispenseId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DispenseItem_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem"("itemId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DispenseItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("stockItemId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DispenseItem_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("drugId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Indexing to support queue and FEFO lookups
CREATE INDEX "Prescription_visitId_status_idx" ON "Prescription"("visitId", "status");
CREATE INDEX "Prescription_patientId_status_idx" ON "Prescription"("patientId", "status");
CREATE INDEX "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");
CREATE INDEX "Dispense_prescriptionId_idx" ON "Dispense"("prescriptionId");
CREATE INDEX "DispenseItem_dispenseId_idx" ON "DispenseItem"("dispenseId");
CREATE INDEX "DispenseItem_prescriptionItemId_idx" ON "DispenseItem"("prescriptionItemId");
CREATE INDEX "StockItem_drugId_idx" ON "StockItem"("drugId");
CREATE INDEX "StockItem_location_idx" ON "StockItem"("location");
CREATE INDEX "StockItem_expiryDate_idx" ON "StockItem"("expiryDate");
