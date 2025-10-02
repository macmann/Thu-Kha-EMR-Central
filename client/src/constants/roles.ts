import type { Role } from '../api/client';

export const ROLE_LABELS: Record<Role, string> = {
  Doctor: 'Doctor',
  AdminAssistant: 'Administrative Assistant',
  Cashier: 'Cashier',
  ITAdmin: 'IT Administrator',
  SystemAdmin: 'System Administrator',
  SuperAdmin: 'Super Administrator',
  Pharmacist: 'Pharmacist',
  PharmacyTech: 'Pharmacy Technician',
  InventoryManager: 'Inventory Manager',
  Nurse: 'Nurse',
  LabTech: 'Laboratory Technician',
};

export const STAFF_ROLES: Role[] = [
  'AdminAssistant',
  'Cashier',
  'ITAdmin',
  'Pharmacist',
  'PharmacyTech',
  'InventoryManager',
  'Nurse',
  'LabTech',
];

export const CLINICALLY_GLOBAL_ROLES: Role[] = ['Doctor', 'SystemAdmin', 'SuperAdmin'];
