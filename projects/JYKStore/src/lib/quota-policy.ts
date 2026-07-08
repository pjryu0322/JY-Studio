export type QuotaPlanId = "FREE";

export type QuotaEnforcement = "ENFORCE" | "WARN_ONLY";

export type QuotaPolicy = {
  plan: QuotaPlanId;
  perMinuteRequests: number;
  perDayRequests: number;
  enforcement: QuotaEnforcement;
  blockingEnabled: boolean;
};

export const DEFAULT_QUOTA_POLICY: QuotaPolicy = {
  plan: "FREE",
  perMinuteRequests: 30,
  perDayRequests: 1000,
  enforcement: "ENFORCE",
  blockingEnabled: true,
};

const NEAR_LIMIT_RATIO = 0.8;

export function getNearLimitRatio(): number {
  return NEAR_LIMIT_RATIO;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function parseEnforcement(raw: string | undefined): QuotaEnforcement {
  const normalized = raw?.trim().toUpperCase();
  if (normalized === "WARN_ONLY") return "WARN_ONLY";
  if (normalized === "ENFORCE") return "ENFORCE";
  return DEFAULT_QUOTA_POLICY.enforcement;
}

export function loadQuotaPolicy(
  env: NodeJS.ProcessEnv = process.env,
): QuotaPolicy {
  const perMinuteRequests = parsePositiveInt(
    env.JYKSTORE_QUOTA_PER_MINUTE,
    DEFAULT_QUOTA_POLICY.perMinuteRequests,
  );
  const perDayRequests = parsePositiveInt(
    env.JYKSTORE_QUOTA_PER_DAY,
    DEFAULT_QUOTA_POLICY.perDayRequests,
  );
  const enforcement = parseEnforcement(env.JYKSTORE_QUOTA_ENFORCEMENT);

  return {
    plan: "FREE",
    perMinuteRequests,
    perDayRequests,
    enforcement,
    blockingEnabled: enforcement === "ENFORCE",
  };
}

export function getQuotaPolicy(): QuotaPolicy {
  return loadQuotaPolicy();
}
