-- Planning-stage PostgreSQL settings (credentials server-side on execution_setups)

ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "planningDatabaseSettingsJson" JSONB;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "planningPostgresPassword" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "planningPostgresPasswordMasked" TEXT;
