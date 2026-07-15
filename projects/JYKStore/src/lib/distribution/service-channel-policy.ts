export type ServiceChannel = "API" | "MCP" | "DOWNLOAD";

export type ServiceChannelFlags = {
  allowApi: boolean;
  allowMcp: boolean;
  allowDownload: boolean;
  serviceEndsAt?: Date | string | null;
};

export function isServiceEnded(serviceEndsAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!serviceEndsAt) return false;
  const end = typeof serviceEndsAt === "string" ? new Date(serviceEndsAt) : serviceEndsAt;
  if (Number.isNaN(end.getTime())) return false;
  // End of calendar day in server local time → compare by date start of next day? Use exact timestamp.
  return end.getTime() <= now.getTime();
}

export function selectedServiceChannels(flags: ServiceChannelFlags): ServiceChannel[] {
  const channels: ServiceChannel[] = [];
  if (flags.allowApi) channels.push("API");
  if (flags.allowMcp) channels.push("MCP");
  if (flags.allowDownload) channels.push("DOWNLOAD");
  return channels;
}

export function assertServiceChannelEnabled(
  channel: ServiceChannel,
  flags: ServiceChannelFlags,
): { ok: true } | { ok: false; code: string; message: string } {
  if (isServiceEnded(flags.serviceEndsAt)) {
    return {
      ok: false,
      code: "SERVICE_ENDED",
      message: "서비스 종료일이 지나 해당 지식팩을 사용할 수 없습니다.",
    };
  }
  if (channel === "API" && !flags.allowApi) {
    return {
      ok: false,
      code: "SERVICE_CHANNEL_DISABLED",
      message: "이 지식팩은 Retrieval API 제공이 허용되지 않았습니다.",
    };
  }
  if (channel === "MCP" && !flags.allowMcp) {
    return {
      ok: false,
      code: "SERVICE_CHANNEL_DISABLED",
      message: "이 지식팩은 MCP 제공이 허용되지 않았습니다.",
    };
  }
  if (channel === "DOWNLOAD" && !flags.allowDownload) {
    return {
      ok: false,
      code: "SERVICE_CHANNEL_DISABLED",
      message: "이 지식팩은 원본문서 다운로드 제공이 허용되지 않았습니다.",
    };
  }
  return { ok: true };
}

export const DISTRIBUTION_RIGHTS_BASIS = [
  "PUBLIC_LICENSE",
  "RIGHTS_HOLDER",
  "AUTHORIZED_BY_RIGHTS_HOLDER",
  "OTHER",
] as const;

export type DistributionRightsBasisCode = (typeof DISTRIBUTION_RIGHTS_BASIS)[number];

export function isDistributionRightsBasis(value: string): value is DistributionRightsBasisCode {
  return (DISTRIBUTION_RIGHTS_BASIS as readonly string[]).includes(value);
}

/** Compat licenseName for non-public-license rights bases. */
export function licenseNameForRightsBasis(
  rightsBasis: DistributionRightsBasisCode,
  licenseNameInput: string | null | undefined,
): string {
  if (rightsBasis === "PUBLIC_LICENSE") {
    return (licenseNameInput ?? "").trim();
  }
  return rightsBasis;
}

/** Client-safe readiness helper (no Prisma). */
export function isDistributionReadyForServiceValidation(dist: {
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  rightsBasis?: string | null;
  rightsConfirmedAt?: Date | string | null;
  allowApi?: boolean;
  allowMcp?: boolean;
  allowDownload?: boolean;
}): boolean {
  const hasSource = Boolean(dist.sourceTitle?.trim() || dist.sourceUrl?.trim());
  const hasRights = Boolean(dist.rightsBasis && dist.rightsConfirmedAt);
  const hasChannel =
    selectedServiceChannels({
      allowApi: Boolean(dist.allowApi),
      allowMcp: Boolean(dist.allowMcp),
      allowDownload: Boolean(dist.allowDownload),
    }).length > 0;
  return hasSource && hasRights && hasChannel;
}
