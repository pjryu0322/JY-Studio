import { prisma } from "@/lib/prisma";
import { getQuotaPolicy, type QuotaPolicy } from "@/lib/quota-policy";

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
