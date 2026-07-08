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

export type QuotaSummaryRange = "24h" | "7d";

export type QuotaClientSummary = {
  clientId: string;
  requestCount: number;
  quotaExceededCount: number;
  uniqueApiKeyCount: number;
  topEndpoint: string | null;
};

export type QuotaSummaryDto = {
  range: QuotaSummaryRange;
  policy: QuotaPolicy;
  totalRequests: number;
  quotaExceededCount: number;
  topClients: QuotaClientSummary[];
  topEndpoints: Array<{ endpoint: string; requestCount: number }>;
};

function isQuotaExceededRow(row: {
  statusCode: number;
  metadata: unknown;
}): boolean {
  if (row.statusCode === 429) return true;
  if (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) {
    return (row.metadata as Record<string, unknown>).reason === "QUOTA_EXCEEDED";
  }
  return false;
}

export async function getAdminQuotaSummary(input: {
  range: QuotaSummaryRange;
  clientId?: string;
}): Promise<QuotaSummaryDto> {
  const policy = getQuotaPolicy();
  const now = new Date();
  const since =
    input.range === "7d"
      ? new Date(now.getTime() - 7 * 24 * 60 * 60_000)
      : new Date(now.getTime() - 24 * 60 * 60_000);

  const where = {
    createdAt: { gte: since },
    ...(input.clientId?.trim() ? { clientId: input.clientId.trim() } : {}),
  };

  const [totalRequests, rows] = await Promise.all([
    prisma.apiUsageLog.count({ where }),
    prisma.apiUsageLog.findMany({
      where,
      select: {
        clientId: true,
        apiKeyId: true,
        endpoint: true,
        statusCode: true,
        metadata: true,
      },
      take: 5000,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const clientMap = new Map<
    string,
    {
      requestCount: number;
      quotaExceededCount: number;
      apiKeyIds: Set<string>;
      endpoints: Map<string, number>;
    }
  >();
  const endpointMap = new Map<string, number>();
  let quotaExceededCount = 0;

  for (const row of rows) {
    const key = row.clientId?.trim() || row.apiKeyId || "unknown";
    const exceeded = isQuotaExceededRow(row);
    if (exceeded) quotaExceededCount += 1;

    const next = clientMap.get(key) ?? {
      requestCount: 0,
      quotaExceededCount: 0,
      apiKeyIds: new Set<string>(),
      endpoints: new Map<string, number>(),
    };
    next.requestCount += 1;
    if (exceeded) next.quotaExceededCount += 1;
    if (row.apiKeyId) next.apiKeyIds.add(row.apiKeyId);
    next.endpoints.set(row.endpoint, (next.endpoints.get(row.endpoint) ?? 0) + 1);
    clientMap.set(key, next);

    endpointMap.set(row.endpoint, (endpointMap.get(row.endpoint) ?? 0) + 1);
  }

  const topClients: QuotaClientSummary[] = [...clientMap.entries()]
    .map(([clientId, data]) => {
      let topEndpoint: string | null = null;
      let topCount = 0;
      for (const [endpoint, count] of data.endpoints) {
        if (count > topCount) {
          topCount = count;
          topEndpoint = endpoint;
        }
      }
      return {
        clientId,
        requestCount: data.requestCount,
        quotaExceededCount: data.quotaExceededCount,
        uniqueApiKeyCount: data.apiKeyIds.size,
        topEndpoint,
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 20);

  const topEndpoints = [...endpointMap.entries()]
    .map(([endpoint, requestCount]) => ({ endpoint, requestCount }))
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 20);

  return {
    range: input.range,
    policy,
    totalRequests,
    quotaExceededCount,
    topClients,
    topEndpoints,
  };
}
