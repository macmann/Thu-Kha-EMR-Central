-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('Scheduled', 'CheckedIn', 'InProgress', 'Completed', 'Cancelled');

-- CreateTable
CREATE TABLE "Appointment" (
    "appointmentId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "department" TEXT NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "startTimeMin" INTEGER NOT NULL,
    "endTimeMin" INTEGER NOT NULL,
    "reason" TEXT,
    "location" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'Scheduled',
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("appointmentId"),
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("doctorId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DoctorAvailability" (
    "availabilityId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "doctorId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    CONSTRAINT "DoctorAvailability_pkey" PRIMARY KEY ("availabilityId"),
    CONSTRAINT "DoctorAvailability_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("doctorId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DoctorBlackout" (
    "blackoutId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "doctorId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    CONSTRAINT "DoctorBlackout_pkey" PRIMARY KEY ("blackoutId"),
    CONSTRAINT "DoctorBlackout_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("doctorId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Appointment_doctorId_date_startTimeMin_endTimeMin_idx" ON "Appointment"("doctorId", "date", "startTimeMin", "endTimeMin");

-- CreateIndex
CREATE INDEX "Appointment_patientId_date_idx" ON "Appointment"("patientId", "date");

-- CreateIndex
CREATE INDEX "DoctorAvailability_doctorId_dayOfWeek_idx" ON "DoctorAvailability"("doctorId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "DoctorBlackout_doctorId_startAt_endAt_idx" ON "DoctorBlackout"("doctorId", "startAt", "endAt");
