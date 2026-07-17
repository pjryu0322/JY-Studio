-- resultFingerprint + download test evidence
ALTER TABLE "ServiceValidationRun" ADD COLUMN IF NOT EXISTS "resultFingerprint" TEXT;

CREATE INDEX IF NOT EXISTS "ServiceValidationRun_resultFingerprint_idx"
  ON "ServiceValidationRun"("resultFingerprint");

CREATE TABLE IF NOT EXISTS "ServiceValidationDownloadTest" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "testedByUserId" TEXT NOT NULL,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseReady" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ServiceValidationDownloadTest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceValidationDownloadTest_runId_key"
  ON "ServiceValidationDownloadTest"("runId");

CREATE INDEX IF NOT EXISTS "ServiceValidationDownloadTest_testedByUserId_idx"
  ON "ServiceValidationDownloadTest"("testedByUserId");

CREATE INDEX IF NOT EXISTS "ServiceValidationDownloadTest_fileId_idx"
  ON "ServiceValidationDownloadTest"("fileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceValidationDownloadTest_runId_fkey'
  ) THEN
    ALTER TABLE "ServiceValidationDownloadTest"
      ADD CONSTRAINT "ServiceValidationDownloadTest_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "ServiceValidationRun"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
