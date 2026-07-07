import type { RateLimitPolicyDto } from "@/lib/rate-limit-policy";

export type OpsRange = "24h" | "7d";

export type OpsSummaryDto = {
  generatedAt: string;
  range: OpsRange;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  errorRate: number;
  averageLatencyMs: number;
  maxLatencyMs: number;
  uniqueApiKeyCount: number;
  topEndpoints: {
    endpoint: string;
    count: number;
    errorCount: number;
    averageLatencyMs: number;
  }[];
  topPacks: {
    packId: string;
    count: number;
  }[];
  rateLimitPolicy: RateLimitPolicyDto;
};

export type OpsUsageLogItemDto = {
  id: string;
  requestId: string;
  apiKeyId: string | null;
  apiKeyLabel: string;
  packId: string | null;
  endpoint: string;
  method: string;
  query: string | null;
  statusCode: number;
  latencyMs: number;
  metadata: unknown;
  createdAt: string;
};

export type OpsAuditLogItemDto = {
  id: string;
  clientId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
};

export type OpsHealthDto = {
  generatedAt: string;
  database: {
    ok: boolean;
    latencyMs: number;
  };
  contextApi: {
    recentRequestCount: number;
    recentErrorCount: number;
    recentErrorRate: number;
    averageLatencyMs: number;
  };
  data: {
    publishedPackCount: number;
    reviewingPackCount: number;
    activeChunkCount: number;
    apiKeyCount: number;
  };
};
