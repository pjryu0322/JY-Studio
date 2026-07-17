-- Prisma created this as UNIQUE INDEX, not a table CONSTRAINT; prior migration's DROP CONSTRAINT was a no-op.
DROP INDEX IF EXISTS "ServiceValidationRun_versionId_channel_key";
