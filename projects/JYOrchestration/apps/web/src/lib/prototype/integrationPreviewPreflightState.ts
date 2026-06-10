const DEFAULT_MAX_AGE_MINUTES = 10;

function parseIsoMs(value: string | null | undefined): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

export type PreviewDeploymentPreflightStaleReasonV1 =
  | "missing_checked_at"
  | "before_integration_run"
  | "before_token_update"
  | "before_repo_update"
  | "max_age_exceeded";

export function isPreviewDeploymentPreflightSnapshotStale(input: {
  readonly checkedAt?: string | null;
  readonly currentRunStartedAt?: string | null;
  readonly tokenUpdatedAt?: string | null;
  readonly repoUpdatedAt?: string | null;
  readonly maxAgeMinutes?: number;
}): boolean {
  return resolvePreviewDeploymentPreflightStaleReason(input) != null;
}

export function resolvePreviewDeploymentPreflightStaleReason(input: {
  readonly checkedAt?: string | null;
  readonly currentRunStartedAt?: string | null;
  readonly tokenUpdatedAt?: string | null;
  readonly repoUpdatedAt?: string | null;
  readonly maxAgeMinutes?: number;
}): PreviewDeploymentPreflightStaleReasonV1 | null {
  const checkedMs = parseIsoMs(input.checkedAt);
  if (checkedMs == null) return "missing_checked_at";

  const runMs = parseIsoMs(input.currentRunStartedAt);
  if (runMs != null && checkedMs < runMs) return "before_integration_run";

  const tokenMs = parseIsoMs(input.tokenUpdatedAt);
  if (tokenMs != null && checkedMs < tokenMs) return "before_token_update";

  const repoMs = parseIsoMs(input.repoUpdatedAt);
  if (repoMs != null && checkedMs < repoMs) return "before_repo_update";

  const maxAgeMinutes = input.maxAgeMinutes ?? DEFAULT_MAX_AGE_MINUTES;
  if (maxAgeMinutes > 0) {
    const ageMs = Date.now() - checkedMs;
    if (ageMs > maxAgeMinutes * 60_000) return "max_age_exceeded";
  }

  return null;
}

export function readPreviewDeploymentPreflightCheckedAtFromCapability(
  raw: unknown,
): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const cap = raw as Record<string, unknown>;
  const nested = cap.previewDeploymentPreflightCheckedAt;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  const connection = cap.autoGenerationConnectionTestV1 ?? cap["autoGenerationConnectionTestV1"];
  if (connection && typeof connection === "object" && !Array.isArray(connection)) {
    const checkedAt = (connection as Record<string, unknown>).checkedAt;
    if (typeof checkedAt === "string" && checkedAt.trim()) return checkedAt.trim();
  }
  return null;
}

export function markPreviewDeploymentPreflightSnapshotStale(
  capability: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...capability,
    previewDeploymentPreflightStale: true,
  };
}
