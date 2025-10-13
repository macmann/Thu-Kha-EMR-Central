ALTER TABLE "Appointment"
  ADD COLUMN "reminder24SentAt" TIMESTAMPTZ(3),
  ADD COLUMN "reminder3SentAt" TIMESTAMPTZ(3);
