import { prisma } from "@/lib/prisma";
import {
  getNearLimitRatio,
  getQuotaPolicy,
  type QuotaPolicy,
} from "@/lib/quota-policy";

export type QuotaCheckInput = {
  clientId: string | null;
  apiKeyId: string;
  endpoint: string;
  method: string;
  now?: Date;
};

export type QuotaUsageSnapshot = {
  minuteCount: number;
  dayCount: number;
  perMinuteLimit: number;
  perDayLimit: number;
};

export type QuotaEvaluation =
  | {
      ok: true;
      policy: QuotaPolicy;
      usage: QuotaUsageSnapshot;
      warning?: "NEAR_MINUTE_LIMIT" | "NEAR_DAY_LIMIT";
    }
  | {
      ok: false;
      status: 429;
      code: "QUOTA_EXCEEDED";
      message: string;
      policy: QuotaPolicy;
      usage: QuotaUsageSnapshot;
      retryAfterSeconds: number;
      reason: "PER_MINUTE" | "PER_DAY";
    };

export type QuotaCheckResult = QuotaEvaluation & { tenantKey: string };

export function resolveTenantKey(clientId: string | null, apiKeyId: string): string {
  const trimmed = clientId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : apiKeyId;
}

export function evaluateQuotaUsage(input: {
  minuteCount: number;
  dayCount: number;
  policy: QuotaPolicy;
  now?: Date;
  minuteWindowStartedAt?: Date;
}): QuotaEvaluation {
  const now = input.now ?? new Date();
  const policy = input.policy;
  const usage: QuotaUsageSnapshot = {
    minuteCount: input.minuteCount,
    dayCount: input.dayCount,
    perMinuteLimit: policy.perMinuteRequests,
    perDayLimit: policy.perDayRequests,
  };

  const nearRatio = getNearLimitRatio();
  let warning: "NEAR_MINUTE_LIMIT" | "NEAR_DAY_LIMIT" | undefined;
  if (input.minuteCount / policy.perMinuteRequests >= nearRatio) {
    warning = "NEAR_MINUTE_LIMIT";
  } else if (input.dayCount / policy.perDayRequests >= nearRatio) {
    warning = "NEAR_DAY_LIMIT";
  }

  const overMinute = input.minuteCount >= policy.perMinuteRequests;
  const overDay = input.dayCount >= policy.perDayRequests;

  if ((overMinute || overDay) && policy.blockingEnabled) {
    const reason: "PER_MINUTE" | "PER_DAY" = overMinute ? "PER_MINUTE" : "PER_DAY";
    const elapsedInWindowMs =
      now.getTime() - (input.minuteWindowStartedAt?.getTime() ?? now.getTime() - 60_000);
    const retryAfterSeconds =
      reason === "PER_MINUTE"
        ? Math.max(1, Math.ceil(60 - elapsedInWindowMs / 1000))
        : 60;

    return {
      ok: false,
      status: 429,
      code: "QUOTA_EXCEEDED",
      message: "API quota를 초과했습니다.",
      policy,
      usage,
      retryAfterSeconds,
      reason,
    };
  }

  if ((overMinute || overDay) && !policy.blockingEnabled) {
    return {
      ok: true,
      policy,
      usage,
      warning: overMinute ? "NEAR_MINUTE_LIMIT" : "NEAR_DAY_LIMIT",
    };
  }

  return {
    ok: true,
    policy,
    usage,
    warning,
  };
}

async function countUsageInWindow(input: {
  tenantKey: string;
  apiKeyId: string;
  since: Date;
}): Promise<number> {
  return prisma.apiUsageLog.count({
    where: {
      createdAt: { gte: input.since },
      OR: [{ clientId: input.tenantKey }, { apiKeyId: input.apiKeyId, clientId: null }],
    },
  });
}

export async function checkQuota(input: QuotaCheckInput): Promise<QuotaCheckResult> {
  const now = input.now ?? new Date();
  const policy = getQuotaPolicy();
  const tenantKey = resolveTenantKey(input.clientId, input.apiKeyId);
  const minuteStartedAt = new Date(now.getTime() - 60_000);
  const dayStartedAt = new Date(now.getTime() - 24 * 60 * 60_000);

  const [minuteCount, dayCount] = await Promise.all([
    countUsageInWindow({ tenantKey, apiKeyId: input.apiKeyId, since: minuteStartedAt }),
    countUsageInWindow({ tenantKey, apiKeyId: input.apiKeyId, since: dayStartedAt }),
  ]);

  const evaluated = evaluateQuotaUsage({
    minuteCount,
    dayCount,
    policy,
    now,
    minuteWindowStartedAt: minuteStartedAt,
  });

  return {
    ...evaluated,
    tenantKey,
  };
}

export type {
  QuotaSummaryRange,
  QuotaClientSummary,
  QuotaSummaryDto,
} from "@/lib/quota-summary-service";

export { getAdminQuotaSummary } from "@/lib/quota-summary-service";
