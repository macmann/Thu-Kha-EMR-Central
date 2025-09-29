import {
  LabItemStatus,
  LabOrderStatus,
  PrismaClient,
  Prisma,
  type LabOrder,
  type LabOrderItem,
  type LabResult,
} from '@prisma/client';
import type {
  CreateLabOrderInput,
  EnterLabResultInput,
} from '../validation/clinical.js';

const prisma = new PrismaClient();

type LabOrderWithItems = LabOrder & { items: LabOrderItem[] };

type ListLabOrderFilters = {
  patientId?: string;
  visitId?: string;
  status?: string;
};

export async function createLabOrder(
  doctorId: string,
  tenantId: string,
  payload: CreateLabOrderInput,
): Promise<LabOrderWithItems> {
  const order = await prisma.labOrder.create({
    data: {
      visitId: payload.visitId,
      patientId: payload.patientId,
      doctorId,
      tenantId,
      priority: payload.priority ?? null,
      notes: payload.notes ?? null,
      items: {
        create: payload.items.map((item) => ({
          testCode: item.testCode,
          testName: item.testName,
          specimen: item.specimen ?? null,
          notes: item.notes ?? null,
        })),
      },
    },
    include: { items: true },
  });

  return order;
}

export async function listLabOrders(filters: ListLabOrderFilters, tenantId: string) {
  const where: Prisma.LabOrderWhereInput = { tenantId };
  if (filters.patientId) {
    where.patientId = filters.patientId;
  }
  if (filters.visitId) {
    where.visitId = filters.visitId;
  }
  if (filters.status) {
    const normalized = filters.status.trim().toUpperCase();
    if (normalized && Object.values(LabOrderStatus).includes(normalized as LabOrderStatus)) {
      where.status = normalized as LabOrderStatus;
    }
  }

  return prisma.labOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: { results: { orderBy: { resultedAt: 'desc' } } },
      },
      results: { orderBy: { resultedAt: 'desc' } },
    },
  });
}

export function computeAbnormal(
  num?: number | null,
  low?: number | null,
  high?: number | null,
): string | null {
  if (typeof num !== 'number' || Number.isNaN(num)) {
    return null;
  }
  if (typeof low === 'number' && !Number.isNaN(low) && num < low) {
    return 'L';
  }
  if (typeof high === 'number' && !Number.isNaN(high) && num > high) {
    return 'H';
  }
  return null;
}

async function resolvePatientId(
  labOrderItemId: string,
  fallbackPatientId?: string,
): Promise<{ labOrderId: string; patientId: string; tenantId: string }> {
  const item = await prisma.labOrderItem.findUnique({
    where: { labOrderItemId },
    include: { LabOrder: true },
  });
  if (!item || !item.LabOrder) {
    const error = new Error('Lab order item not found');
    (error as any).statusCode = 404;
    throw error;
  }

  return {
    labOrderId: item.labOrderId,
    patientId: fallbackPatientId ?? item.LabOrder.patientId,
    tenantId: item.LabOrder.tenantId,
  };
}

async function resolveReferenceDefaults(testCode: string) {
  if (!testCode) {
    return { unit: null, refLow: null, refHigh: null };
  }
  const entry = await prisma.labCatalog.findUnique({ where: { testCode } });
  return {
    unit: entry?.unit ?? null,
    refLow: entry?.refLow ?? null,
    refHigh: entry?.refHigh ?? null,
  };
}

export async function enterLabResult(
  labTechUserId: string,
  payload: EnterLabResultInput,
): Promise<LabResult> {
  const { labOrderId, patientId, tenantId } = await resolvePatientId(
    payload.labOrderItemId,
    payload.patientId,
  );

  const orderItem = await prisma.labOrderItem.findUnique({
    where: { labOrderItemId: payload.labOrderItemId },
  });
  if (!orderItem) {
    const error = new Error('Lab order item not found');
    (error as any).statusCode = 404;
    throw error;
  }

  let referenceLow = payload.referenceLow ?? null;
  let referenceHigh = payload.referenceHigh ?? null;
  let unit = payload.unit ?? null;

  if (referenceLow == null || referenceHigh == null || unit == null) {
    const defaults = await resolveReferenceDefaults(orderItem.testCode);
    referenceLow = referenceLow ?? (defaults.refLow ? Number(defaults.refLow) : null);
    referenceHigh = referenceHigh ?? (defaults.refHigh ? Number(defaults.refHigh) : null);
    unit = unit ?? defaults.unit;
  }

  const abnormalFlag = computeAbnormal(
    payload.resultValueNum ?? null,
    referenceLow,
    referenceHigh,
  );

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.labResult.create({
      data: {
        labOrderId,
        labOrderItemId: payload.labOrderItemId,
        patientId,
        tenantId,
        resultValue: payload.resultValue ?? null,
        resultValueNum: payload.resultValueNum ?? null,
        unit,
        referenceLow,
        referenceHigh,
        abnormalFlag,
        resultedBy: labTechUserId,
        notes: payload.notes ?? null,
      },
    });

    await tx.labOrderItem.update({
      where: { labOrderItemId: payload.labOrderItemId },
      data: { status: LabItemStatus.RESULTED },
    });

    const siblingItems = await tx.labOrderItem.findMany({
      where: { labOrderId },
      select: { labOrderItemId: true, status: true },
    });

    const allResulted = siblingItems.every((item) => item.status === LabItemStatus.RESULTED);

    const currentOrder = await tx.labOrder.findUnique({
      where: { labOrderId },
      select: { status: true },
    });

    if (currentOrder && currentOrder.status !== LabOrderStatus.CANCELLED) {
      await tx.labOrder.update({
        where: { labOrderId },
        data: {
          status: allResulted ? LabOrderStatus.COMPLETED : LabOrderStatus.IN_PROGRESS,
        },
      });
    }

    return created;
  });

  return result;
}

export async function getLabOrderDetail(labOrderId: string, tenantId: string) {
  return prisma.labOrder.findFirst({
    where: { labOrderId, tenantId },
    include: {
      items: {
        include: { results: { orderBy: { resultedAt: 'desc' } } },
      },
      results: { orderBy: { resultedAt: 'desc' } },
    },
  });
}

export async function generateLabReportPdf(labOrderId: string) {
  // Placeholder implementation. A real implementation would build a PDF buffer.
  return Buffer.from(`PDF report for lab order ${labOrderId}`);
}
