-- Append-only ServiceValidationRun: drop unique(versionId, channel), add invalidatedAt + indexes
ALTER TABLE "ServiceValidationRun" DROP CONSTRAINT IF EXISTS "ServiceValidationRun_versionId_channel_key";

ALTER TABLE "ServiceValidationRun" ADD COLUMN IF NOT EXISTS "invalidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ServiceValidationRun_versionId_channel_createdAt_idx"
  ON "ServiceValidationRun"("versionId", "channel", "createdAt");

CREATE INDEX IF NOT EXISTS "ServiceValidationRun_versionId_channel_status_idx"
  ON "ServiceValidationRun"("versionId", "channel", "status");

CREATE INDEX IF NOT EXISTS "ServiceValidationRun_packId_createdAt_idx"
  ON "ServiceValidationRun"("packId", "createdAt");
