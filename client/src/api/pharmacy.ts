import { fetchJSON } from './http';

export type PharmacyQueueStatus = 'PENDING' | 'PARTIAL' | 'DISPENSED';

export interface PharmacyQueueItem {
  prescriptionId: string;
  status: PharmacyQueueStatus;
  notes?: string | null;
  createdAt: string;
  patient?: { patientId: string; name: string };
  doctor?: { doctorId: string; name: string };
  items: Array<{
    itemId: string;
    drugId: string;
    dose: string;
    route: string;
    frequency: string;
    durationDays: number;
    quantityPrescribed: number;
  }>;
}

export async function listPharmacyQueue(
  status?: PharmacyQueueStatus | PharmacyQueueStatus[],
): Promise<PharmacyQueueItem[]> {
  const params = new URLSearchParams();
  if (status) {
    const values = Array.isArray(status) ? status : [status];
    if (values.length) {
      params.set('status', values.join(','));
    }
  }

  const query = params.toString();
  const response = await fetchJSON(`/pharmacy/prescriptions${query ? `?${query}` : ''}`);
  return ((response as { data?: PharmacyQueueItem[] }).data) ?? [];
}

export interface InventoryLocationSummary {
  location: string;
  qtyOnHand: number;
}

export interface LowStockInventoryItem {
  drugId: string;
  name: string;
  genericName: string | null;
  strength: string;
  form: string;
  totalOnHand: number;
  locations: InventoryLocationSummary[];
}

export async function listLowStockInventory(params?: {
  limit?: number;
  threshold?: number;
}): Promise<LowStockInventoryItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) {
    searchParams.set('limit', String(params.limit));
  }
  if (params?.threshold !== undefined) {
    searchParams.set('threshold', String(params.threshold));
  }

  const query = searchParams.toString();
  const response = await fetchJSON(
    `/pharmacy/inventory/low-stock${query ? `?${query}` : ''}`,
  );
  return ((response as { data?: LowStockInventoryItem[] }).data) ?? [];
}
