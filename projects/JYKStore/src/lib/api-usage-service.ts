import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export function createRequestId() {
  return `req_${crypto.randomUUID()}`;
}

export async function recordApiUsage(input: {
  requestId: string;
  apiKeyId: string | null;
  packId?: string;
  endpoint: string;
  target?: string;
  query?: string;
  statusCode: number;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}) {
  const chunkCount =
    typeof input.metadata?.chunkCount === "number" ? input.metadata.chunkCount : undefined;

  await prisma.apiUsageLog.create({
    data: {
      requestId: input.requestId,
      apiKeyId: input.apiKeyId,
      packId: input.packId,
      endpoint: input.endpoint,
      target: input.target ?? reasonFromMetadata(input.metadata),
      query: input.query ?? stringFromMetadata(input.metadata?.query),
      usedChunks: chunkCount ?? 0,
      statusCode: input.statusCode,
    },
  });
}

function stringFromMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function reasonFromMetadata(metadata?: Record<string, unknown>): string | undefined {
  const reason = metadata?.reason;
  return typeof reason === "string" ? reason : undefined;
}
