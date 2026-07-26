/**
 * Admin workbench step4 — service validation readiness ViewModel.
 * Derives CTA / blocked reasons from workflow markers + channel gates (no DB enums).
 */

export type AdminServiceChannelGateRow = {
  channel: string;
  label: string;
  passed: boolean;
  reason: string | null;
  reasonCode?: string | null;
};

export type AdminServiceChannelGatesSnapshot = {
  allPassed: boolean;
  serviceValidationReady?: boolean;
  bindingStatus?: string;
  bindingReason?: string | null;
  channels: AdminServiceChannelGateRow[];
  missingLabels: string[];
};

export type AdminServiceValidationStatus =
  | "BLOCKED"
  | "NEEDS_CHANNELS"
  | "READY"
  | "DONE";

export type AdminServiceValidationViewModel = {
  status: AdminServiceValidationStatus;
  blockedReasons: string[];
  missingChannels: AdminServiceChannelGateRow[];
  channels: AdminServiceChannelGateRow[];
  bindingStatus: string | null;
  bindingReason: string | null;
  allPassed: boolean;
  canMarkPassed: boolean;
  primaryLabel: string;
  summaryTone: "amber" | "emerald" | "slate";
  summaryMessage: string | null;
};

export function buildAdminServiceValidationViewModel(input: {
  providerConfirmed: boolean;
  openSupplement: boolean;
  serviceDone: boolean;
  channelGates: AdminServiceChannelGatesSnapshot | null;
}): AdminServiceValidationViewModel {
  const blockedReasons: string[] = [];
  if (!input.providerConfirmed) {
    blockedReasons.push("제공자 확인이 완료되지 않아 서비스 검증 완료를 기록할 수 없습니다.");
  }
  if (input.openSupplement) {
    blockedReasons.push(
      "제공자 보완요청이 처리되지 않아 서비스 검증을 완료할 수 없습니다. 제공자 검토 단계에서 보완요청을 처리하세요.",
    );
  }

  const gates = input.channelGates;
  const bindingStatus = gates?.bindingStatus ?? null;
  const bindingReason = gates?.bindingReason ?? null;
  const channels = gates?.channels ?? [];
  const missingChannels = channels.filter((c) => !c.passed);
  const allPassed = Boolean(gates?.allPassed);

  if (gates == null && input.providerConfirmed && !input.openSupplement) {
    blockedReasons.push("채널 검증 상태를 확인하는 중입니다.");
  }
  if (gates && bindingStatus && bindingStatus !== "CURRENT") {
    blockedReasons.push(
      bindingReason ?? "최신 산출물 기준 API/MCP/ZIP 검증을 다시 수행해야 합니다.",
    );
  }
  if (gates && !allPassed) {
    blockedReasons.push(
      missingChannels.length > 0
        ? `미검증 채널: ${missingChannels.map((c) => c.label).join(", ")}`
        : "미검증 채널이 있습니다.",
    );
  }

  if (input.serviceDone) {
    return {
      status: "DONE",
      blockedReasons: [],
      missingChannels,
      channels,
      bindingStatus,
      bindingReason,
      allPassed,
      canMarkPassed: false,
      primaryLabel: "서비스 검증 완료됨 · 최종 검수 판단으로 이동",
      summaryTone: "emerald",
      summaryMessage: "서비스 검증이 완료되었습니다. 최종 검수 판단으로 이동하세요.",
    };
  }

  const canMarkPassed =
    input.providerConfirmed &&
    !input.openSupplement &&
    gates != null &&
    allPassed &&
    bindingStatus === "CURRENT";

  if (canMarkPassed) {
    return {
      status: "READY",
      blockedReasons: [],
      missingChannels: [],
      channels,
      bindingStatus,
      bindingReason,
      allPassed: true,
      canMarkPassed: true,
      primaryLabel: "검증 확인 완료 · 최종 검수 판단으로 이동",
      summaryTone: "emerald",
      summaryMessage: "API·MCP·ZIP/RAG Export 검증이 모두 통과했습니다.",
    };
  }

  const status: AdminServiceValidationStatus =
    blockedReasons.some(
      (r) =>
        r.includes("제공자 확인") ||
        r.includes("보완요청") ||
        r.includes("확인하는 중"),
    )
      ? "BLOCKED"
      : "NEEDS_CHANNELS";

  return {
    status,
    blockedReasons,
    missingChannels,
    channels,
    bindingStatus,
    bindingReason,
    allPassed,
    canMarkPassed: false,
    primaryLabel: "검증 확인 완료 · 최종 검수 판단으로 이동",
    summaryTone: "amber",
    summaryMessage: blockedReasons[0] ?? null,
  };
}
