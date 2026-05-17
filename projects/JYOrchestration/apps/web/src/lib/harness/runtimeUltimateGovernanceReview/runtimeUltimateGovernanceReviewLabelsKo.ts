/**
 * H40 — ultimate governance review overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeUltimateGovernanceReviewMode,
  RuntimeUltimateGovernanceReviewStatus,
} from "./runtimeUltimateGovernanceReviewTypes";

export const RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 orchestration/execution/governance enforcement가 아니라, ultimate governance review와 final orchestration readiness boundary를 설명하는 read-only metadata입니다.";

export const RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_OVERLAY_FOOTER_KO =
  "actual orchestration·execution·execution routing·release enforcement·approval enforcement·execution blocking·merge blocking·routing·queue control·rollback·prompt 변경은 없습니다.";

export const RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_STATUS_LABEL_KO: Readonly<
  Record<RuntimeUltimateGovernanceReviewStatus, string>
> = {
  not_ready: "미준비",
  ultimate_governance_metadata_ready: "ultimate governance 메타 준비됨",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_MODE_LABEL_KO: Readonly<
  Record<RuntimeUltimateGovernanceReviewMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO = {
  inputEnvelope: "orchestration readiness input envelope 행이 없습니다.",
  outputEnvelope: "orchestration readiness output envelope 행이 없습니다.",
  forbiddenOperation: "금지 boundary operation이 없습니다.",
  noEnforcementProof: "ultimate no-enforcement proof 행이 없습니다.",
  forbiddenProof: "orchestration-forbidden proof 행이 없습니다.",
  checklist: "final orchestration readiness checklist 행이 없습니다.",
  missingChecklist: "누락 checklist 행이 없습니다.",
  blocker: "ultimate governance blocker가 없습니다.",
  recommendation: "권장 사항이 없습니다.",
} as const;
