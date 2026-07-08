import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SENSITIVE_METADATA_KEYS = [
  "authorization",
  "apiKey",
  "api_key",
  "plainKey",
  "plain_key",
  "rawKey",
  "raw_key",
  "token",
  "bearer",
  "keyHash",
  "key_hash",
  "secret",
  "password",
];

export function createRequestId() {
  return `req_${crypto.randomUUID()}`;
}

export function sanitizeUsageMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalized = key.toLowerCase();
    const sensitive = SENSITIVE_METADATA_KEYS.some((item) => normalized.includes(item.toLowerCase()));

    if (sensitive) {
      result[key] = "[REDACTED]";
      continue;
    }

    if (value === undefined) continue;

    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export async function recordApiUsage(input: {
  requestId: string;
  apiKeyId: string | null;
  clientId?: string | null;
  tenantKey?: string | null;
  packId?: string;
  endpoint: string;
  method?: string;
  target?: string;
  query?: string;
  statusCode: number;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}) {
  const sanitizedMetadata = sanitizeUsageMetadata(input.metadata);
  const chunkCount =
    typeof sanitizedMetadata?.chunkCount === "number" ? sanitizedMetadata.chunkCount : undefined;
  const clientId = input.clientId?.trim() || input.tenantKey?.trim() || null;

  await prisma.apiUsageLog.create({
    data: {
      requestId: input.requestId,
      apiKeyId: input.apiKeyId,
      clientId,
      packId: input.packId,
      endpoint: input.endpoint,
      method: input.method,
      target: input.target ?? reasonFromMetadata(sanitizedMetadata),
      query: input.query ?? stringFromMetadata(sanitizedMetadata?.query),
      usedChunks: chunkCount ?? 0,
      statusCode: input.statusCode,
      latencyMs: input.latencyMs,
      metadata: sanitizedMetadata as Prisma.InputJsonValue | undefined,
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
