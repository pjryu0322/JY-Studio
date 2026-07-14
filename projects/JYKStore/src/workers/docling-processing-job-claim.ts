/**
 * Pure helpers for Docling processing worker claim eligibility and retry backoff.
 */

export const DEFAULT_DOCLING_JOB_LOCK_LEASE_MS = 10 * 60 * 1000;

/** Backoff after attempt N failure (attemptCount after increment): 30s, 2m, then fail. */
export const DOCLING_RETRY_BACKOFF_MS = [30_000, 120_000] as const;

export type DoclingJobClaimCandidate = {
  status: string;
  nextRunAt: Date | null;
  lockExpiresAt: Date | null;
};

/**
 * Whether a job row is eligible to be claimed at `now`.
 * Matches worker SQL: PENDING | (RETRY_WAIT & nextRunAt<=now) | (RUNNING & lock expired).
 */
export function isDoclingJobClaimEligible(
  job: DoclingJobClaimCandidate,
  now: Date = new Date(),
): boolean {
  if (job.status === "PENDING") return true;
  if (job.status === "RETRY_WAIT") {
    if (!job.nextRunAt) return true;
    return job.nextRunAt.getTime() <= now.getTime();
  }
  if (job.status === "RUNNING") {
    if (!job.lockExpiresAt) return false;
    return job.lockExpiresAt.getTime() < now.getTime();
  }
  return false;
}

/**
 * Delay before next retry given attemptCount AFTER the failed attempt was counted.
 * Returns null when no retries remain (caller should FAILED).
 *
 * attemptCount=1 → 30s, attemptCount=2 → 2m, attemptCount>=maxAttempts → null
 */
export function computeDoclingRetryDelayMs(
  attemptCount: number,
  maxAttempts: number,
): number | null {
  if (attemptCount >= maxAttempts) return null;
  const index = Math.max(0, attemptCount - 1);
  if (index >= DOCLING_RETRY_BACKOFF_MS.length) {
    // No more backoff slots — treat as final failure even if maxAttempts is higher.
    return null;
  }
  return DOCLING_RETRY_BACKOFF_MS[index]!;
}

export function computeDoclingLockExpiresAt(
  now: Date = new Date(),
  leaseMs: number = Number.parseInt(
    process.env.JYKSTORE_DOCLING_JOB_LOCK_LEASE_MS ?? "",
    10,
  ) || DEFAULT_DOCLING_JOB_LOCK_LEASE_MS,
): Date {
  return new Date(now.getTime() + leaseMs);
}

export function isDoclingTransientProcessingError(
  code: string | null | undefined,
): boolean {
  if (!code) return true;
  const permanent = new Set([
    "DOCLING_SCHEMA_INVALID",
    "DOCLING_ORIGIN_MISMATCH",
    "SOURCE_FILENAME_MISMATCH",
    "SOURCE_MIMETYPE_MISMATCH",
    "DOCLING_INCOMPLETE_FILES",
    "DOCLING_FILE_SIGNATURE_MISMATCH",
    "DOCLING_FILE_CONTENT_INVALID",
    "DOCLING_HTML_CONTENT_INVALID",
    "DOCLING_OFFICE_PACKAGE_INVALID",
    "DOCLING_OFFICE_REQUIRED_ENTRY_MISSING",
    "DOCLING_ENTITY_LIMIT_EXCEEDED",
    "DOCLING_VALIDATION_FAILED",
    "DOCLING_JSON_MARKDOWN_MISMATCH",
    "DOCLING_JSON_MARKDOWN_LOW_COVERAGE",
  ]);
  return !permanent.has(code);
}
