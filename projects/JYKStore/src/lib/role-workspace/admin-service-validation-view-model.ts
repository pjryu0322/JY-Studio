/**
 * Admin workbench — service validation readiness ViewModel.
 * Derives CTA / blocked reasons from workflow markers + channel gates (no DB enums).
 *
 * P2: provider confirmation is NOT a prerequisite for marking SV passed.
 * Provider review is a publish gate that runs after SERVICE_VALIDATION.
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

export type AdminServiceValidationChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
};

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
  checklist: AdminServiceValidationChecklistItem[];
  howToRunHint: string;
};

function displayChannelLabel(channel: string, label: string): string {
  if (channel === "DOWNLOAD" || label === "DOWNLOAD") return "ZIP/RAG Export";
  return label;
}

export function buildAdminServiceValidationViewModel(input: {
  /** @deprecated P2 — ignored for gate decisions; kept for call-site compatibility. */
  providerConfirmed?: boolean;
  openSupplement: boolean;
  serviceDone: boolean;
  channelGates: AdminServiceChannelGatesSnapshot | null;
}): AdminServiceValidationViewModel {
  const blockedReasons: string[] = [];
  if (input.openSupplement) {
    blockedReasons.push(
      "제공자 보완요청이 처리되지 않아 서비스 검증을 완료할 수 없습니다. 보정 단계에서 보완요청을 처리하세요.",
    );
  }

  const gates = input.channelGates;
  const bindingStatus = gates?.bindingStatus ?? null;
  const bindingReason = gates?.bindingReason ?? null;
  const channels = (gates?.channels ?? []).map((c) => ({
    ...c,
    label: displayChannelLabel(c.channel, c.label),
  }));
  const missingChannels = channels.filter((c) => !c.passed);
  const allPassed = Boolean(gates?.allPassed);
  const bindingCurrent = bindingStatus === "CURRENT";

  if (gates == null && !input.openSupplement) {
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

  const checklist: AdminServiceValidationChecklistItem[] = [
    {
      id: "supplement",
      label: "열린 제공자 보완요청 없음",
      done: !input.openSupplement,
      detail: input.openSupplement ? "보완요청을 먼저 처리하세요." : undefined,
    },
    {
      id: "binding",
      label: "최신 Worker 산출물 바인딩",
      done: bindingCurrent,
      detail: bindingCurrent
        ? undefined
        : bindingReason ?? "바인딩이 CURRENT가 아닙니다. 채널 검증을 다시 실행하세요.",
    },
    {
      id: "api",
      label: "API 채널 검증 통과",
      done: channels.find((c) => c.channel === "API")?.passed === true,
    },
    {
      id: "mcp",
      label: "MCP 채널 검증 통과",
      done: channels.find((c) => c.channel === "MCP")?.passed === true,
    },
    {
      id: "rag",
      label: "ZIP/RAG Export 채널 검증 통과",
      done:
        channels.find((c) => c.channel === "DOWNLOAD")?.passed === true ||
        channels.find((c) => c.label.includes("RAG"))?.passed === true,
    },
  ];

  const howToRunHint =
    "채널 검증은 아래 운영 로그·검증 도구에서 실행·확인합니다. 상태를 반영하려면 ‘채널 상태 새로고침’을 누르세요.";

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
      primaryLabel: "서비스 검증 완료됨 · 게시 단계로 이동",
      summaryTone: "emerald",
      summaryMessage: "서비스 검증이 완료되었습니다. 게시 단계에서 제공자 검토를 요청하세요.",
      checklist: checklist.map((c) => ({ ...c, done: true })),
      howToRunHint,
    };
  }

  const canMarkPassed =
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
      primaryLabel: "검증 확인 완료 · 게시 단계로 이동",
      summaryTone: "emerald",
      summaryMessage: "API·MCP·ZIP/RAG Export 검증이 모두 통과했습니다.",
      checklist,
      howToRunHint,
    };
  }

  const status: AdminServiceValidationStatus = blockedReasons.some(
    (r) => r.includes("보완요청") || r.includes("확인하는 중"),
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
    primaryLabel: "검증 확인 완료 · 게시 단계로 이동",
    summaryTone: "amber",
    summaryMessage: blockedReasons[0] ?? null,
    checklist,
    howToRunHint,
  };
}
