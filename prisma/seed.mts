import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_TENANT_CODE = process.env.DEFAULT_TENANT_CODE ?? 'default';
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? 'Primary Clinic';
const SYSTEM_ADMIN_EMAIL = process.env.SYSTEM_ADMIN_EMAIL ?? 'sysadmin@example.com';
const SYSTEM_ADMIN_PASSWORD = process.env.SYSTEM_ADMIN_PASSWORD ?? 'SysAdminPass123!';

async function ensureSystemAdminRole() {
  const result = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'Role' AND e.enumlabel = 'SystemAdmin'
    ) AS "exists";
  `;

  const hasRole = result[0]?.exists ?? false;

  if (!hasRole) {
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE 'SystemAdmin'`);
    console.log('✅ Added SystemAdmin role to enum');
  }
}

async function ensureSystemAdminUser(tenantId: string) {
  const passwordHash = await bcrypt.hash(SYSTEM_ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: SYSTEM_ADMIN_EMAIL },
    update: {
      passwordHash,
      role: 'SystemAdmin',
      status: 'active',
      doctorId: null,
    },
    create: {
      email: SYSTEM_ADMIN_EMAIL,
      passwordHash,
      role: 'SystemAdmin',
      status: 'active',
      doctorId: null,
    },
  });

  await prisma.userTenant.upsert({
    where: { tenantId_userId: { tenantId, userId: user.userId } },
    update: { role: 'SystemAdmin' },
    create: { tenantId, userId: user.userId, role: 'SystemAdmin' },
  });

  console.log(`✅ Ensured system admin user ${SYSTEM_ADMIN_EMAIL}`);
}

async function ensureDefaultTenant() {
  const tenant = await prisma.tenant.upsert({
    where: { code: DEFAULT_TENANT_CODE },
    update: { name: DEFAULT_TENANT_NAME },
    create: { name: DEFAULT_TENANT_NAME, code: DEFAULT_TENANT_CODE },
  });

  await prisma.tenantConfiguration.upsert({
    where: { tenantId: tenant.tenantId },
    update: { appName: DEFAULT_TENANT_NAME },
    create: { tenantId: tenant.tenantId, appName: DEFAULT_TENANT_NAME },
  });

  return tenant;
}

async function assignAdminsToTenant(tenantId: string) {
  const admins = await prisma.user.findMany({
    where: {
      status: 'active',
      role: { in: ['ITAdmin', 'SystemAdmin', 'AdminAssistant'] },
    },
    select: { userId: true, role: true },
  });

  await Promise.all(
    admins.map((admin) =>
      prisma.userTenant.upsert({
        where: { tenantId_userId: { tenantId, userId: admin.userId } },
        update: { role: admin.role },
        create: { tenantId, userId: admin.userId, role: admin.role },
      }),
    ),
  );
}

async function seedPharmacyReference(tenantId: string) {
  const entries = [
    {
      drug: {
        drugId: '00000000-0000-0000-0000-000000000001',
        name: 'Amoxicillin',
        genericName: 'amoxicillin',
        form: 'tab',
        strength: '500 mg',
        routeDefault: 'PO',
      },
      stock: {
        stockItemId: '11111111-0000-0000-0000-000000000001',
        batchNo: 'BATCH-0001',
      },
    },
    {
      drug: {
        drugId: '00000000-0000-0000-0000-000000000002',
        name: 'Paracetamol',
        genericName: 'acetaminophen',
        form: 'tab',
        strength: '500 mg',
        routeDefault: 'PO',
      },
      stock: {
        stockItemId: '11111111-0000-0000-0000-000000000002',
        batchNo: 'BATCH-0002',
      },
    },
    {
      drug: {
        drugId: '00000000-0000-0000-0000-000000000003',
        name: 'Ibuprofen',
        genericName: 'ibuprofen',
        form: 'tab',
        strength: '200 mg',
        routeDefault: 'PO',
      },
      stock: {
        stockItemId: '11111111-0000-0000-0000-000000000003',
        batchNo: 'BATCH-0003',
      },
    },
  ];

  for (const entry of entries) {
    const drug = await prisma.drug.upsert({
      where: { drugId: entry.drug.drugId },
      update: entry.drug,
      create: entry.drug,
    });

    await prisma.stockItem.upsert({
      where: { stockItemId: entry.stock.stockItemId },
      update: {
        drugId: drug.drugId,
        tenantId,
      },
      create: {
        stockItemId: entry.stock.stockItemId,
        drugId: drug.drugId,
        tenantId,
        batchNo: entry.stock.batchNo,
        expiryDate: new Date('2026-12-31'),
        location: 'COUNTER_A',
        qtyOnHand: 200,
        unitCost: 100.0,
      },
    });
  }

  console.log('✅ Seeded drugs + stock');
}

async function seedLabCatalog() {
  const entries: Array<Prisma.LabCatalogUpsertArgs> = [
    {
      where: { testCode: 'CBC' },
      update: {},
      create: {
        testCode: 'CBC',
        testName: 'Complete Blood Count',
        unit: null,
        refLow: null,
        refHigh: null,
        panel: true,
      },
    },
    {
      where: { testCode: 'HGB' },
      update: {},
      create: {
        testCode: 'HGB',
        testName: 'Hemoglobin',
        unit: 'g/dL',
        refLow: new Prisma.Decimal(12),
        refHigh: new Prisma.Decimal(17.5),
        panel: false,
      },
    },
    {
      where: { testCode: 'WBC' },
      update: {},
      create: {
        testCode: 'WBC',
        testName: 'White Blood Cell Count',
        unit: 'x10^9/L',
        refLow: new Prisma.Decimal(4),
        refHigh: new Prisma.Decimal(11),
        panel: false,
      },
    },
    {
      where: { testCode: 'PLT' },
      update: {},
      create: {
        testCode: 'PLT',
        testName: 'Platelet Count',
        unit: 'x10^9/L',
        refLow: new Prisma.Decimal(150),
        refHigh: new Prisma.Decimal(450),
        panel: false,
      },
    },
    {
      where: { testCode: 'LFT_ALT' },
      update: {},
      create: {
        testCode: 'LFT_ALT',
        testName: 'Alanine Aminotransferase (ALT)',
        unit: 'U/L',
        refLow: new Prisma.Decimal(7),
        refHigh: new Prisma.Decimal(56),
        panel: false,
      },
    },
    {
      where: { testCode: 'FBS' },
      update: {},
      create: {
        testCode: 'FBS',
        testName: 'Fasting Blood Sugar',
        unit: 'mmol/L',
        refLow: new Prisma.Decimal(3.9),
        refHigh: new Prisma.Decimal(5.5),
        panel: false,
      },
    },
  ];

  for (const entry of entries) {
    await prisma.labCatalog.upsert(entry);
  }

  console.log('✅ Seeded lab catalog');
}

async function main() {
  // Run legacy seed first to ensure baseline data remains available.
  await ensureSystemAdminRole();
  await import('./seed.mjs');
  await prisma.serviceCatalog.upsert({
    where: { code: 'CONSULT_OPD' },
    update: { name: 'OPD Consultation', defaultPrice: new Prisma.Decimal(8000) },
    create: {
      code: 'CONSULT_OPD',
      name: 'OPD Consultation',
      defaultPrice: new Prisma.Decimal(8000),
    },
  });
  await prisma.serviceCatalog.upsert({
    where: { code: 'PROC_DRESSING' },
    update: { name: 'Dressing', defaultPrice: new Prisma.Decimal(5000) },
    create: {
      code: 'PROC_DRESSING',
      name: 'Dressing',
      defaultPrice: new Prisma.Decimal(5000),
    },
  });
  await prisma.serviceCatalog.upsert({
    where: { code: 'PROC_INJ' },
    update: { name: 'Injection', defaultPrice: new Prisma.Decimal(3000) },
    create: {
      code: 'PROC_INJ',
      name: 'Injection',
      defaultPrice: new Prisma.Decimal(3000),
    },
  });
  const tenant = await ensureDefaultTenant();
  await seedPharmacyReference(tenant.tenantId);
  await ensureSystemAdminUser(tenant.tenantId);
  await assignAdminsToTenant(tenant.tenantId);
  await seedLabCatalog();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
