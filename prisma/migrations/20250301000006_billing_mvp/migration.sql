-- Billing & invoicing MVP
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'Cashier';

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'VOID', 'REFUNDED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'MOBILE_WALLET', 'BANK_TRANSFER', 'OTHER');
CREATE TYPE "ItemSourceType" AS ENUM ('SERVICE', 'PHARMACY', 'LAB');

CREATE TABLE "ServiceCatalog" (
    "serviceId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultPrice" DECIMAL(12, 2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("serviceId")
);

CREATE UNIQUE INDEX "ServiceCatalog_code_key" ON "ServiceCatalog"("code");

CREATE TABLE "PriceList" (
    "priceId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "serviceId" UUID NOT NULL,
    "overridePrice" DECIMAL(12, 2),
    "effectiveFrom" TIMESTAMPTZ(3),
    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("priceId"),
    CONSTRAINT "PriceList_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("serviceId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Invoice" (
    "invoiceId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceNo" TEXT NOT NULL,
    "visitId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'MMK',
    "note" TEXT,
    "subTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "discountAmt" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "taxAmt" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "amountDue" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("invoiceId"),
    CONSTRAINT "Invoice_invoiceNo_key" UNIQUE ("invoiceNo"),
    CONSTRAINT "Invoice_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("visitId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Invoice_visitId_status_idx" ON "Invoice"("visitId", "status");

CREATE TABLE "InvoiceItem" (
    "itemId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL,
    "sourceType" "ItemSourceType" NOT NULL,
    "sourceRefId" TEXT,
    "serviceId" UUID,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12, 2) NOT NULL,
    "discountAmt" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "taxAmt" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12, 2) NOT NULL,
    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("itemId"),
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("invoiceId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("serviceId") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_sourceType_sourceRefId_idx" ON "InvoiceItem"("sourceType", "sourceRefId");

CREATE TABLE "Payment" (
    "paymentId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "paidAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceNo" TEXT,
    "note" TEXT,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("paymentId"),
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("invoiceId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

CREATE TABLE "PaymentAllocation" (
    "allocationId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paymentId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("allocationId"),
    CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("paymentId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("invoiceId") ON DELETE CASCADE ON UPDATE CASCADE
);
