import type { PrismaClient } from '@prisma/client';

export type AppointmentStatus =
  | 'Scheduled'
  | 'CheckedIn'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled';

export type DateTimeFilter = {
  gte?: Date;
  gt?: Date;
  lte?: Date;
  lt?: Date;
};

export type AppointmentWhereInput = {
  date?: Date | DateTimeFilter;
  doctorId?: string;
  status?: AppointmentStatus;
};

export interface AppointmentFindManyArgs {
  where?: AppointmentWhereInput;
  include?: {
    patient?: { select: { patientId: true; name: true } };
    doctor?: { select: { doctorId: true; name: true; department: true } };
  };
  orderBy?: Array<{ date?: 'asc' | 'desc'; startTimeMin?: 'asc' | 'desc' }>;
  take?: number;
  skip?: number;
  cursor?: { appointmentId: string };
}

export type AppointmentUpdateData = {
  patientId?: string;
  guestName?: string | null;
  doctorId?: string;
  department?: string;
  date?: Date;
  startTimeMin?: number;
  endTimeMin?: number;
  reason?: string | null;
  location?: string | null;
  status?: AppointmentStatus;
  cancelReason?: string | null;
};

type FindMany = (args?: any) => Promise<any>;

type AppointmentDelegate = {
  findMany: FindMany;
  findFirst: (args: any) => Promise<any>;
  findUnique: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

type AvailabilityDelegate = {
  findMany: FindMany;
};

type BlackoutDelegate = {
  findMany: FindMany;
  findFirst: (args: any) => Promise<any>;
};

type VisitDelegate = {
  findFirst: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
};

type BaseTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export type AppPrismaClient = PrismaClient & {
  appointment: AppointmentDelegate;
  doctorAvailability: AvailabilityDelegate;
  doctorBlackout: BlackoutDelegate;
  visit: VisitDelegate;
};

export type AppPrismaTransactionClient = BaseTransactionClient & {
  appointment: AppointmentDelegate;
  doctorAvailability: AvailabilityDelegate;
  doctorBlackout: BlackoutDelegate;
  visit: VisitDelegate;
};
