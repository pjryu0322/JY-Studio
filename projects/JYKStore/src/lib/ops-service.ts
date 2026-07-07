import { PackStatus, type Prisma } from "@prisma/client";
import { maskId, sanitizeMetadata, truncateText } from "@/lib/masking";
import type {
  OpsAuditLogItemDto,
  OpsHealthDto,
  OpsRange,
  OpsSummaryDto,
  OpsUsageLogItemDto,
} from "@/lib/ops-dto";
import { prisma } from "@/lib/prisma";
import { getRateLimitPolicyDto } from "@/lib/rate-limit-policy";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const QUERY_MAX_LENGTH = 100;

function clampLimit(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function rangeSince(range: OpsRange): Date {
  const now = Date.now();
  const ms = range === "7d" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(now - ms);
}

function isError(statusCode: number): boolean {
  return statusCode >= 400;
}

export async function getOpsSummary(range: OpsRange = "24h"): Promise<OpsSummaryDto> {
  const since = rangeSince(range);

  const logs = await prisma.apiUsageLog.findMany({
    where: { createdAt: { gte: since } },
    select: {
      apiKeyId: true,
      packId: true,
      endpoint: true,
      statusCode: true,
      latencyMs: true,
    },
  });

  const totalRequests = logs.length;
  let successCount = 0;
  let errorCount = 0;
  let latencySum = 0;
  let latencyCount = 0;
  let maxLatencyMs = 0;
  const apiKeys = new Set<string>();
  const endpointMap = new Map<string, { count: number; errorCount: number; latencySum: number; latencyCount: number }>();
  const packMap = new Map<string, number>();

  for (const log of logs) {
    if (isError(log.statusCode)) errorCount += 1;
    else successCount += 1;

    if (typeof log.latencyMs === "number") {
      latencySum += log.latencyMs;
      latencyCount += 1;
      if (log.latencyMs > maxLatencyMs) maxLatencyMs = log.latencyMs;
    }

    if (log.apiKeyId) apiKeys.add(log.apiKeyId);

    const endpointStats = endpointMap.get(log.endpoint) ?? {
      count: 0,
      errorCount: 0,
      latencySum: 0,
      latencyCount: 0,
    };
    endpointStats.count += 1;
    if (isError(log.statusCode)) endpointStats.errorCount += 1;
    if (typeof log.latencyMs === "number") {
      endpointStats.latencySum += log.latencyMs;
      endpointStats.latencyCount += 1;
    }
    endpointMap.set(log.endpoint, endpointStats);

    if (log.packId) {
      packMap.set(log.packId, (packMap.get(log.packId) ?? 0) + 1);
    }
  }

  const topEndpoints = [...endpointMap.entries()]
    .map(([endpoint, stats]) => ({
      endpoint,
      count: stats.count,
      errorCount: stats.errorCount,
      averageLatencyMs: stats.latencyCount > 0 ? Math.round(stats.latencySum / stats.latencyCount) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topPacks = [...packMap.entries()]
    .map(([packId, count]) => ({ packId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    range,
    totalRequests,
    successCount,
    errorCount,
    errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
    averageLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
    maxLatencyMs,
    uniqueApiKeyCount: apiKeys.size,
    topEndpoints,
    topPacks,
    rateLimitPolicy: getRateLimitPolicyDto(),
  };
}

export async function listOpsUsageLogs(input?: {
  limit?: number;
  status?: "success" | "error";
  endpoint?: string;
  packId?: string;
}): Promise<OpsUsageLogItemDto[]> {
  const where: Prisma.ApiUsageLogWhereInput = {};

  if (input?.status === "success") {
    where.statusCode = { gte: 200, lt: 400 };
  } else if (input?.status === "error") {
    where.statusCode = { gte: 400 };
  }
  if (input?.endpoint?.trim()) {
    where.endpoint = { contains: input.endpoint.trim(), mode: "insensitive" };
  }
  if (input?.packId?.trim()) {
    where.packId = input.packId.trim();
  }

  const rows = await prisma.apiUsageLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: clampLimit(input?.limit),
  });

  return rows.map((row) => ({
    id: row.id,
    requestId: row.requestId,
    apiKeyId: row.apiKeyId ? maskId(row.apiKeyId) : null,
    apiKeyLabel: row.apiKeyId ? maskId(row.apiKeyId) : "API Key 없음",
    packId: row.packId,
    endpoint: row.endpoint,
    method: row.method ?? "",
    query: truncateText(row.query, QUERY_MAX_LENGTH),
    statusCode: row.statusCode,
    latencyMs: row.latencyMs ?? 0,
    metadata: sanitizeMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listOpsAuditLogs(input?: {
  limit?: number;
  action?: string;
  entityType?: string;
}): Promise<OpsAuditLogItemDto[]> {
  const where: Prisma.AuditLogWhereInput = {};

  if (input?.action?.trim()) {
    where.action = input.action.trim() as Prisma.AuditLogWhereInput["action"];
  }
  if (input?.entityType?.trim()) {
    where.entityType = { contains: input.entityType.trim(), mode: "insensitive" };
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: clampLimit(input?.limit),
  });

  return rows.map((row) => ({
    id: row.id,
    clientId: row.actorUserId ? maskId(row.actorUserId) : null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId ? maskId(row.entityId) : null,
    metadata: sanitizeMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getOpsHealth(): Promise<OpsHealthDto> {
  const dbStart = Date.now();
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const dbLatencyMs = Date.now() - dbStart;

  const since = rangeSince("24h");

  const [recentLogs, publishedPackCount, reviewingPackCount, activeChunkCount, apiKeyCount] =
    await Promise.all([
      prisma.apiUsageLog.findMany({
        where: { createdAt: { gte: since } },
        select: { statusCode: true, latencyMs: true },
      }),
      prisma.knowledgePack.count({
        where: { status: { in: [PackStatus.PUBLISHED, PackStatus.VERIFIED] } },
      }),
      prisma.knowledgePack.count({ where: { status: PackStatus.REVIEWING } }),
      prisma.knowledgeChunk.count({ where: { isActive: true } }),
      prisma.apiKey.count(),
    ]);

  const recentRequestCount = recentLogs.length;
  let recentErrorCount = 0;
  let latencySum = 0;
  let latencyCount = 0;
  for (const log of recentLogs) {
    if (isError(log.statusCode)) recentErrorCount += 1;
    if (typeof log.latencyMs === "number") {
      latencySum += log.latencyMs;
      latencyCount += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    database: { ok: dbOk, latencyMs: dbLatencyMs },
    contextApi: {
      recentRequestCount,
      recentErrorCount,
      recentErrorRate: recentRequestCount > 0 ? recentErrorCount / recentRequestCount : 0,
      averageLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
    },
    data: {
      publishedPackCount,
      reviewingPackCount,
      activeChunkCount,
      apiKeyCount,
    },
  };
}
