import type { ProjectReferenceSelectionSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";

/** 사용자-facing chip labels (단일 출처) */
export const REFERENCE_PLANNING_CHIP_VIEW = "참조 정보 보기";
export const REFERENCE_PLANNING_CHIP_CLEAR = "참조 해제";
export const REFERENCE_PLANNING_CHIP_CONTINUE = "계속 진행";
export const REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT = "참조 컨텍스트 준비" as const;

/** @deprecated 내부 호환 — `REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT`와 동일 */
export const REFERENCE_PLANNING_CHIP_MATERIALIZE = REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT;

export const REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE = "reference-snapshot-planning-welcome" as const;
export const REFERENCE_PLANNING_INFO_VIEW_INTERNAL_TYPE = "reference-snapshot-planning-info-view" as const;
export const REFERENCE_PLANNING_CLEAR_NOTICE_INTERNAL_TYPE = "reference-snapshot-planning-clear-notice" as const;
export const REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE =
  "reference-snapshot-planning-legacy-missing" as const;
export const REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_INTERNAL_TYPE =
  "reference-snapshot-planning-materialize-success" as const;
export const REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_INTERNAL_TYPE =
  "reference-snapshot-planning-materialize-failed" as const;

/** @deprecated 내부 호환 */
export const REFERENCE_PLANNING_MATERIALIZE_SUCCESS_INTERNAL_TYPE =
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_INTERNAL_TYPE;
/** @deprecated 내부 호환 */
export const REFERENCE_PLANNING_MATERIALIZE_FAILED_INTERNAL_TYPE =
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_INTERNAL_TYPE;

export const REFERENCE_PLANNING_CLEAR_NOTICE_BODY = "참조 프로젝트 선택을 해제했습니다.";

export const REFERENCE_PLANNING_LEGACY_MISSING_BODY = `선택된 참조 정보가 이전 형식으로 저장되어 있습니다.
참조 프로젝트를 수정하지 않고, 현재 프로젝트 안에 AI 기획용 참조 컨텍스트만 준비할 수 있습니다.`;

export const REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY = `참조 컨텍스트를 현재 프로젝트에 준비했습니다.
참조 프로젝트와 원본 그래프 스냅샷은 수정되지 않습니다.
이후 AI 기획자는 현재 프로젝트에 저장된 참조 컨텍스트만 사용합니다.`;

/** @deprecated 내부 호환 */
export const REFERENCE_PLANNING_MATERIALIZE_SUCCESS_BODY = REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY;

export const REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY = `참조 컨텍스트를 현재 프로젝트에 준비할 수 없습니다.
다시 시도하거나 참조를 해제해 주세요.`;

/** @deprecated 내부 호환 */
export const REFERENCE_PLANNING_MATERIALIZE_FAILED_DEFAULT_BODY =
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY;

export const REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_TOAST = "참조 컨텍스트를 준비했습니다.";

export const REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE =
  "선택된 참조 정보가 이전 형식으로 저장되어 있습니다. 참조 프로젝트는 수정하지 않고, 현재 프로젝트에 AI 기획용 참조 컨텍스트만 준비할 수 있습니다.";

export type ReferenceContextPrepareFailureStatus =
  | "SOURCE_PERMISSION_DENIED"
  | "SOURCE_UNAVAILABLE"
  | "SNAPSHOT_NOT_READY"
  | "INVALID_SELECTION"
  | "NO_REFERENCE_SELECTION"
  | "UNKNOWN";

export type ReferenceContextPrepareFailureActionPolicy = "RETRY_AND_CLEAR" | "CLEAR_ONLY" | "NONE";

export const REFERENCE_PLANNING_USER_FACING_COPY: readonly string[] = [
  REFERENCE_PLANNING_CHIP_VIEW,
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_CONTINUE,
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
  REFERENCE_PLANNING_CLEAR_NOTICE_BODY,
  REFERENCE_PLANNING_LEGACY_MISSING_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY,
  REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_TOAST,
];

const USER_FACING_BANNED_TERMS = ["보정", "재선택", "batch", "materialize"] as const;

export function assertReferencePlanningUserFacingCopyAllowed(text: string): void {
  const lower = text.toLowerCase();
  for (const term of USER_FACING_BANNED_TERMS) {
    if (term === "materialize") {
      if (lower.includes("materialize")) {
        throw new Error(`Banned user-facing term: ${term}`);
      }
    } else if (text.includes(term)) {
      throw new Error(`Banned user-facing term: ${term}`);
    }
  }
}

export function buildReferencePlanningWelcomeMessageBody(summary: ProjectReferenceSelectionSummaryV1): string {
  return `선택한 참조 프로젝트(${summary.sourceProjectTitle} · ${summary.snapshotTitle})의 구조 정보를 불러왔습니다.
선택한 참조 정보는 새 프로젝트 내부에 안전한 참고 컨텍스트로 저장되었습니다.
이 정보는 복사가 아니라 새 프로젝트 기획을 돕기 위한 참고 자료로만 사용됩니다.
원본 프로젝트를 그대로 복사하지 않으며, 대화 내용과 관련 있는 항목만 기획 컨텍스트로 사용됩니다.
액터, 서비스 흐름, 기능 구조를 참고하되 현재 프로젝트 설명에 맞게 다시 구체화하겠습니다.

Actor ${summary.actorCount}개 · Flow ${summary.serviceFlowCount}개 · Feature ${summary.featureCount}개 · Graph ${summary.graphReusableNodeCount}개

선택한 참조 정보는 모든 답변에 그대로 복사되지 않고, 대화 내용과 관련 있는 항목만 기획 컨텍스트로 사용됩니다.`;
}

export function buildReferencePlanningWelcomeMessageMeta(summary: ProjectReferenceSelectionSummaryV1) {
  return {
    internalType: REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE,
    interviewSuggestions: [
      REFERENCE_PLANNING_CHIP_VIEW,
      REFERENCE_PLANNING_CHIP_CLEAR,
      REFERENCE_PLANNING_CHIP_CONTINUE,
    ],
    referencePlanningSummary: {
      sourceProjectTitle: summary.sourceProjectTitle,
      snapshotTitle: summary.snapshotTitle,
      actorCount: summary.actorCount,
      serviceFlowCount: summary.serviceFlowCount,
      featureCount: summary.featureCount,
      graphReusableNodeCount: summary.graphReusableNodeCount,
    },
  };
}

export function buildReferencePlanningLegacyMissingMessageMeta() {
  return {
    internalType: REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE,
    interviewSuggestions: [REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT, REFERENCE_PLANNING_CHIP_CLEAR],
  };
}

export function buildReferencePlanningContextPrepareSuccessMessageMeta() {
  return {
    internalType: REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_INTERNAL_TYPE,
    interviewSuggestions: [
      REFERENCE_PLANNING_CHIP_VIEW,
      REFERENCE_PLANNING_CHIP_CONTINUE,
      REFERENCE_PLANNING_CHIP_CLEAR,
    ],
  };
}

/** @deprecated 내부 호환 */
export const buildReferencePlanningMaterializeSuccessMessageMeta =
  buildReferencePlanningContextPrepareSuccessMessageMeta;

export function resolveReferenceContextPrepareFailureActionPolicy(
  status: ReferenceContextPrepareFailureStatus,
): ReferenceContextPrepareFailureActionPolicy {
  switch (status) {
    case "SOURCE_PERMISSION_DENIED":
    case "SOURCE_UNAVAILABLE":
    case "INVALID_SELECTION":
      return "CLEAR_ONLY";
    case "SNAPSHOT_NOT_READY":
    case "UNKNOWN":
      return "RETRY_AND_CLEAR";
    case "NO_REFERENCE_SELECTION":
      return "NONE";
    default:
      return "RETRY_AND_CLEAR";
  }
}

export function referenceContextPrepareFailureNoticeChips(
  status: ReferenceContextPrepareFailureStatus,
): readonly string[] {
  const policy = resolveReferenceContextPrepareFailureActionPolicy(status);
  if (policy === "RETRY_AND_CLEAR") {
    return [REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT, REFERENCE_PLANNING_CHIP_CLEAR];
  }
  if (policy === "CLEAR_ONLY") {
    return [REFERENCE_PLANNING_CHIP_CLEAR];
  }
  return [];
}

export function buildReferenceContextPrepareFailureNoticeBody(
  status: ReferenceContextPrepareFailureStatus,
  serverMessage?: string | null,
): string {
  const trimmed = String(serverMessage ?? "").trim();
  switch (status) {
    case "SOURCE_PERMISSION_DENIED":
      return trimmed || "이전 참조 프로젝트에 접근할 권한이 없습니다. 참조를 해제해 주세요.";
    case "SOURCE_UNAVAILABLE":
      return trimmed || "참조 저장본을 다시 확인할 수 없습니다. 참조를 해제해 주세요.";
    case "SNAPSHOT_NOT_READY":
      return trimmed || "참조 저장본이 아직 준비되지 않았습니다. 다시 시도하거나 참조를 해제해 주세요.";
    case "INVALID_SELECTION":
      return trimmed || "저장된 참조 선택 정보가 올바르지 않습니다. 참조를 해제해 주세요.";
    case "NO_REFERENCE_SELECTION":
      return trimmed || "저장된 참조 선택이 없습니다.";
    default:
      return trimmed || REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY;
  }
}

export const REFERENCE_PLANNING_CHIP_LABELS = new Set<string>([
  REFERENCE_PLANNING_CHIP_VIEW,
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_CONTINUE,
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
]);

export function isReferencePlanningChipLabel(label: string): boolean {
  return REFERENCE_PLANNING_CHIP_LABELS.has(String(label ?? "").trim());
}

export function buildReferenceInfoViewMessageBody(summary: ProjectReferenceSelectionSummaryV1): string {
  const statusLabel = summary.readiness === "VERIFIED" ? "VERIFIED" : "READY";
  return `선택된 참조 프로젝트 정보입니다.

프로젝트: ${summary.sourceProjectTitle}
저장본: ${summary.snapshotTitle}
상태: ${statusLabel}
구성: Actor ${summary.actorCount}개 · Flow ${summary.serviceFlowCount}개 · Feature ${summary.featureCount}개 · Graph ${summary.graphReusableNodeCount}개

이 정보는 복사가 아니라 새 프로젝트 기획을 위한 참고 자료로만 사용됩니다.

대화 내용과 관련 있는 항목만 기획 컨텍스트로 주입됩니다.`;
}

/** @deprecated use referenceContextPrepareFailureNoticeChips */
export const referenceMaterializeFailureNoticeChips = referenceContextPrepareFailureNoticeChips;
/** @deprecated use resolveReferenceContextPrepareFailureActionPolicy */
export const resolveReferenceMaterializeFailureActionPolicy = resolveReferenceContextPrepareFailureActionPolicy;
/** @deprecated use buildReferenceContextPrepareFailureNoticeBody */
export const buildReferenceMaterializeFailureNoticeBody = buildReferenceContextPrepareFailureNoticeBody;
