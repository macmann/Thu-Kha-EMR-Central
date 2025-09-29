-- Create trigram indexes for patient search
CREATE INDEX IF NOT EXISTS "Patient_name_trgm_idx" ON "Patient" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Patient_contact_trgm_idx" ON "Patient" USING GIN ("contact" gin_trgm_ops);
