-- RenameColumn
ALTER TABLE "execution_jobs"
RENAME COLUMN "maxRetries" TO "maxAttempts";
