import type { QuotaCheckResult } from "@/lib/quota-service";

export function buildQuotaUsageMetadata(quota?: QuotaCheckResult): Record<string, unknown> {
  if (!quota || !quota.ok) return {};
  return {
    quotaWarning: quota.warning,
    quotaMinuteCount: quota.usage.minuteCount,
    quotaDayCount: quota.usage.dayCount,
    quotaPerMinuteLimit: quota.usage.perMinuteLimit,
    quotaPerDayLimit: quota.usage.perDayLimit,
  };
}
