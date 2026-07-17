import type { PackStatus } from "@prisma/client";
import type { ProviderPackTabId } from "@/lib/provider-pack-tabs";
import { providerPackDetailPath } from "@/lib/routes";

/**
 * Provider registration workflow steps (authoring).
 * Lifecycle (DRAFT / REVIEWING / PUBLISHED / …) is separate — see packStatus.
 */
export type ProviderRegistrationStepId =
  | "BASIC_INFO"
  | "SOURCE_MATERIALS"
  | "DATA_STRUCTURE"
  | "SEARCH_DATA_VALIDATION"
  | "DISTRIBUTION_REVIEW";

export type ProviderRegistrationStepStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "WARNING"
  | "STALE"
  | "BLOCKED"
  | "LOCKED";

export type ProviderRegistrationStep = {
  id: ProviderRegistrationStepId;
  label: string;
  shortLabel: string;
  status: ProviderRegistrationStepStatus;
  statusLabel: string;
  tab: ProviderPackTabId;
  locked: boolean;
  lockReason: string | null;
  href: string | null;
};

export type ProviderRegistrationReadiness = {
  packId: string;
  packStatus: PackStatus;
  basicInfoReady: boolean;
  sourceMaterialsReady: boolean;
  structurePassed: boolean;
  searchFoundationPassed: boolean;
  allPreparationChannelsPassed: boolean;
  distributionMetadataReady: boolean;
  pipelineCurrent: boolean;
  canSubmitReview: boolean;
  submitBlockers: string[];
  steps: ProviderRegistrationStep[];
  currentStepId: ProviderRegistrationStepId | null;
};

export type ResolveProviderRegistrationReadinessInput = {
  packId: string;
  packStatus: PackStatus;
  basicInfoReady: boolean;
  sourceMaterialsReady: boolean;
  /** STRUCTURE + KU + Chunk on current binding. */
  structurePassed: boolean;
  /** SEARCH_INDEX + RETRIEVAL_EVALUATION on current binding. */
  searchFoundationPassed: boolean;
  /** API + MCP + DOWNLOAD PASS + CURRENT + CONFIRMED. */
  allPreparationChannelsPassed: boolean;
  distributionMetadataReady: boolean;
  /** Fingerprint/version/bundle binding matches active materials. */
  pipelineCurrent: boolean;
  /** Structure or search stages marked STALE after material change. */
  structureStale?: boolean;
  searchValidationStale?: boolean;
  latestRejectionReason?: string | null;
};

const STEP_META: Record<
  ProviderRegistrationStepId,
  { label: string; shortLabel: string; tab: ProviderPackTabId; description: string }
> = {
  BASIC_INFO: {
    label: "기본정보",
    shortLabel: "기본",
    tab: "basic",
    description: "지식팩 이름·카테고리·설명·문서 언어",
  },
  SOURCE_MATERIALS: {
    label: "자료 등록",
    shortLabel: "자료",
    tab: "payload",
    description: "원본문서·Docling JSON·정규화 확인",
  },
  DATA_STRUCTURE: {
    label: "데이터 구조화",
    shortLabel: "구조화",
    tab: "knowledge",
    description: "구조 확인·Knowledge Unit·Retrieval Chunk",
  },
  SEARCH_DATA_VALIDATION: {
    label: "검색데이터 생성·검증",
    shortLabel: "검색검증",
    tab: "serviceValidation",
    description: "Draft 인덱스·검색 평가·API·MCP·DOWNLOAD",
  },
  DISTRIBUTION_REVIEW: {
    label: "유통정보·검수요청",
    shortLabel: "유통·검수",
    tab: "distributionReview",
    description: "공개 채널·권리·검수요청",
  },
};

const STATUS_LABEL: Record<ProviderRegistrationStepStatus, string> = {
  NOT_STARTED: "미완료",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
  WARNING: "확인 필요",
  STALE: "다시 생성 필요",
  BLOCKED: "차단",
  LOCKED: "잠김",
};

const REGISTRATION_ORDER: ProviderRegistrationStepId[] = [
  "BASIC_INFO",
  "SOURCE_MATERIALS",
  "DATA_STRUCTURE",
  "SEARCH_DATA_VALIDATION",
  "DISTRIBUTION_REVIEW",
];

function detailHref(packId: string, tab: ProviderPackTabId): string {
  return `${providerPackDetailPath(packId)}?tab=${tab}`;
}

function searchDataValidationComplete(input: ResolveProviderRegistrationReadinessInput): boolean {
  return (
    input.pipelineCurrent &&
    input.searchFoundationPassed &&
    input.allPreparationChannelsPassed
  );
}

/**
 * Single readiness calculator for tabs, list progress, review blockers, and locks.
 */
export function resolveProviderRegistrationReadiness(
  input: ResolveProviderRegistrationReadinessInput,
): ProviderRegistrationReadiness {
  const searchValidationDone = searchDataValidationComplete(input);
  const structureStale = Boolean(input.structureStale) || !input.pipelineCurrent;
  const searchStale = Boolean(input.searchValidationStale) || !input.pipelineCurrent;

  const submitBlockers: string[] = [];
  if (input.packStatus !== "DRAFT") {
    submitBlockers.push("PACK_NOT_DRAFT");
  }
  if (!input.basicInfoReady) submitBlockers.push("BASIC_INFO");
  if (!input.sourceMaterialsReady) submitBlockers.push("SOURCE_MATERIALS");
  if (!input.structurePassed || structureStale) submitBlockers.push("DATA_STRUCTURE");
  if (!input.searchFoundationPassed || searchStale) {
    submitBlockers.push("SEARCH_FOUNDATION");
  }
  if (!input.allPreparationChannelsPassed) {
    submitBlockers.push("PREPARATION_CHANNELS");
  }
  if (!input.distributionMetadataReady) submitBlockers.push("DISTRIBUTION_METADATA");
  if (!input.pipelineCurrent) submitBlockers.push("BINDING_STALE");

  const canSubmitReview =
    input.packStatus === "DRAFT" &&
    input.basicInfoReady &&
    input.sourceMaterialsReady &&
    input.structurePassed &&
    input.searchFoundationPassed &&
    input.allPreparationChannelsPassed &&
    input.distributionMetadataReady &&
    input.pipelineCurrent;

  const locks: Record<ProviderRegistrationStepId, { locked: boolean; reason: string | null }> = {
    BASIC_INFO: { locked: false, reason: null },
    SOURCE_MATERIALS: { locked: false, reason: null },
    DATA_STRUCTURE: {
      locked: !input.sourceMaterialsReady,
      reason: input.sourceMaterialsReady
        ? null
        : "자료 등록 확인을 완료해 주세요.",
    },
    SEARCH_DATA_VALIDATION: {
      locked:
        !input.sourceMaterialsReady ||
        !input.structurePassed ||
        !input.pipelineCurrent,
      reason: !input.sourceMaterialsReady
        ? "자료 등록 확인을 완료해 주세요."
        : !input.structurePassed
          ? "Retrieval Chunk 생성이 완료되지 않았습니다."
          : !input.pipelineCurrent
            ? "등록 자료가 변경되어 구조화 결과를 다시 생성해야 합니다."
            : null,
    },
    DISTRIBUTION_REVIEW: {
      locked: !searchValidationDone,
      reason: !input.structurePassed
        ? "데이터 구조화가 완료되지 않았습니다."
        : !input.searchFoundationPassed
          ? "검색 인덱스·검색 평가가 완료되지 않았습니다."
          : !input.allPreparationChannelsPassed
            ? "API·MCP·DOWNLOAD 검증 결과를 제공자가 확인하지 않았습니다."
            : searchStale
              ? "검색 검증 증적이 현재 자료와 일치하지 않습니다. 다시 검증해 주세요."
              : null,
    },
  };

  function statusFor(
    id: ProviderRegistrationStepId,
    completed: boolean,
    stale: boolean,
  ): ProviderRegistrationStepStatus {
    if (locks[id].locked) return "LOCKED";
    if (stale && (completed || id === "DATA_STRUCTURE" || id === "SEARCH_DATA_VALIDATION")) {
      return "STALE";
    }
    if (completed) return "COMPLETED";
    // Find first incomplete unlocked step → IN_PROGRESS
    return "NOT_STARTED";
  }

  const completedFlags: Record<ProviderRegistrationStepId, boolean> = {
    BASIC_INFO: input.basicInfoReady,
    SOURCE_MATERIALS: input.sourceMaterialsReady,
    DATA_STRUCTURE: input.structurePassed && input.pipelineCurrent,
    SEARCH_DATA_VALIDATION: searchValidationDone,
    DISTRIBUTION_REVIEW:
      searchValidationDone &&
      input.distributionMetadataReady &&
      (input.packStatus === "REVIEWING" ||
        input.packStatus === "PUBLISHED" ||
        input.packStatus === "VERIFIED"),
  };

  // DISTRIBUTION_REVIEW completion for draft authoring = metadata ready (submit is separate).
  if (input.packStatus === "DRAFT" || input.packStatus === "SUSPENDED") {
    completedFlags.DISTRIBUTION_REVIEW =
      searchValidationDone && input.distributionMetadataReady;
  }

  let currentStepId: ProviderRegistrationStepId | null = null;
  for (const id of REGISTRATION_ORDER) {
    if (!completedFlags[id] && !locks[id].locked) {
      currentStepId = id;
      break;
    }
    if (!completedFlags[id] && locks[id].locked) {
      // Stay on last unlocked incomplete predecessor
      break;
    }
  }
  if (!currentStepId) {
    currentStepId = completedFlags.DISTRIBUTION_REVIEW
      ? "DISTRIBUTION_REVIEW"
      : REGISTRATION_ORDER.find((id) => !completedFlags[id]) ?? "DISTRIBUTION_REVIEW";
  }

  const steps: ProviderRegistrationStep[] = REGISTRATION_ORDER.map((id) => {
    const meta = STEP_META[id];
    const stale =
      (id === "DATA_STRUCTURE" && structureStale && input.sourceMaterialsReady) ||
      (id === "SEARCH_DATA_VALIDATION" &&
        searchStale &&
        input.structurePassed);
    let status = statusFor(id, completedFlags[id], stale);

    if (status === "NOT_STARTED" && id === currentStepId && !locks[id].locked) {
      status = "IN_PROGRESS";
    }
    if (
      status === "NOT_STARTED" &&
      !completedFlags[id] &&
      !locks[id].locked &&
      id !== currentStepId
    ) {
      status = "NOT_STARTED";
    }

    return {
      id,
      label: meta.label,
      shortLabel: meta.shortLabel,
      status,
      statusLabel: STATUS_LABEL[status],
      tab: meta.tab,
      locked: locks[id].locked,
      lockReason: locks[id].reason,
      href:
        !locks[id].locked && (status === "IN_PROGRESS" || status === "STALE")
          ? detailHref(input.packId, meta.tab)
          : null,
    };
  });

  return {
    packId: input.packId,
    packStatus: input.packStatus,
    basicInfoReady: input.basicInfoReady,
    sourceMaterialsReady: input.sourceMaterialsReady,
    structurePassed: input.structurePassed,
    searchFoundationPassed: input.searchFoundationPassed,
    allPreparationChannelsPassed: input.allPreparationChannelsPassed,
    distributionMetadataReady: input.distributionMetadataReady,
    pipelineCurrent: input.pipelineCurrent,
    canSubmitReview,
    submitBlockers,
    steps,
    currentStepId,
  };
}

export function registrationStepStatusLabel(
  status: ProviderRegistrationStepStatus,
): string {
  return STATUS_LABEL[status];
}

/** Map readiness steps onto tab lock records. */
export function tabLocksFromRegistrationReadiness(
  readiness: ProviderRegistrationReadiness,
): Record<
  ProviderPackTabId,
  { locked: boolean; reason: string | null }
> {
  const byTab = Object.fromEntries(
    readiness.steps.map((s) => [s.tab, { locked: s.locked, reason: s.lockReason }]),
  ) as Record<ProviderPackTabId, { locked: boolean; reason: string | null }>;
  return {
    basic: byTab.basic ?? { locked: false, reason: null },
    payload: byTab.payload ?? { locked: false, reason: null },
    knowledge: byTab.knowledge ?? { locked: false, reason: null },
    serviceValidation: byTab.serviceValidation ?? { locked: false, reason: null },
    distributionReview: byTab.distributionReview ?? { locked: false, reason: null },
  };
}

export function tabStepStatusesFromRegistrationReadiness(
  readiness: ProviderRegistrationReadiness,
): Partial<
  Record<
    ProviderPackTabId,
    { status: ProviderRegistrationStepStatus; statusLabel: string }
  >
> {
  const byTab: Partial<
    Record<
      ProviderPackTabId,
      { status: ProviderRegistrationStepStatus; statusLabel: string }
    >
  > = {};
  for (const step of readiness.steps) {
    byTab[step.tab] = { status: step.status, statusLabel: step.statusLabel };
  }
  return byTab;
}
