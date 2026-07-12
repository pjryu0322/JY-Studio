import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateQuotaUsage } from "@/lib/quota-service";
import type { QuotaPolicy } from "@/lib/quota-policy";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw?.trim() ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Extract client IP only when TRUST_PROXY is enabled.
 * Never persist the raw IP — only an HMAC tenant key.
 */
export function resolveAnonymousDownloadTenantKey(request: NextRequest): string {
  const secret =
    process.env.JYKSTORE_ANONYMOUS_ID_SECRET?.trim() ||
    process.env.JYKSTORE_API_KEY_SECRET?.trim() ||
    "jykstore-anonymous-fallback";

  let material = "anonymous";
  if (truthy(process.env.JYKSTORE_TRUST_PROXY)) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = request.headers.get("x-real-ip")?.trim();
    material = forwarded || realIp || request.headers.get("cf-connecting-ip")?.trim() || "anonymous";
  }

  const digest = createHmac("sha256", secret).update(material).digest("hex");
  return `anon_payload_${digest.slice(0, 32)}`;
}

function getPayloadDownloadPolicy(): QuotaPolicy {
  return {
    plan: "FREE",
    perMinuteRequests: parseLimit(process.env.JYKSTORE_PAYLOAD_DOWNLOAD_PER_MINUTE, 10),
    perDayRequests: parseLimit(process.env.JYKSTORE_PAYLOAD_DOWNLOAD_PER_DAY, 100),
    enforcement: "ENFORCE",
    blockingEnabled: true,
  };
}

export async function enforcePublicPayloadDownloadQuota(request: NextRequest): Promise<{
  tenantKey: string;
  retryAfterSeconds?: number;
}> {
  const tenantKey = resolveAnonymousDownloadTenantKey(request);
  const now = new Date();
  const minuteStartedAt = new Date(now.getTime() - 60_000);
  const dayStartedAt = new Date(now.getTime() - 24 * 60 * 60_000);
  const endpoint = "/api/v1/packs/:packId/payload/download";

  const [minuteCount, dayCount] = await Promise.all([
    prisma.apiUsageLog.count({
      where: {
        clientId: tenantKey,
        endpoint,
        createdAt: { gte: minuteStartedAt },
      },
    }),
    prisma.apiUsageLog.count({
      where: {
        clientId: tenantKey,
        endpoint,
        createdAt: { gte: dayStartedAt },
      },
    }),
  ]);

  const evaluated = evaluateQuotaUsage({
    minuteCount,
    dayCount,
    policy: getPayloadDownloadPolicy(),
    now,
    minuteWindowStartedAt: minuteStartedAt,
  });

  if (!evaluated.ok) {
    const error = new PayloadServiceError(
      "PAYLOAD_DOWNLOAD_QUOTA_EXCEEDED",
      "다운로드 요청 한도를 초과했습니다.",
      429,
    ) as PayloadServiceError & { retryAfterSeconds: number };
    error.retryAfterSeconds = evaluated.retryAfterSeconds;
    throw error;
  }

  return { tenantKey };
}
