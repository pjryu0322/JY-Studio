/**
 * H12 — Overlay 한글 라벨(read-only).
 */

import type {
  CandidateConflictSeverity,
  CandidateSaturationLevel,
  RuntimeCandidateConflictKind,
  RuntimeStabilityLevel,
} from "./runtimeStabilityTypes";

export const RUNTIME_STABILITY_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 runtime enforcement가 아니라 runtime planning 안정성 진단 정보입니다.";

export const RUNTIME_STABILITY_LEVEL_LABEL_KO: Record<RuntimeStabilityLevel, string> = {
  stable: "안정",
  watch: "주시",
  elevated: "상승",
  unstable: "불안정",
};

export const CANDIDATE_CONFLICT_SEVERITY_LABEL_KO: Record<CandidateConflictSeverity, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

export const CANDIDATE_SATURATION_LEVEL_LABEL_KO: Record<CandidateSaturationLevel, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

export const RUNTIME_CANDIDATE_CONFLICT_KIND_LABEL_KO: Record<RuntimeCandidateConflictKind, string> = {
  provider_routing_conflict: "프로바이더 라우팅 후보 충돌",
  rollback_dependency_conflict: "롤백 dependency 충돌",
  governance_dependency_conflict: "거버넌스 dependency 충돌",
  review_security_overload: "Review/Security 과부하",
  explainability_overload: "Explainability 과부하",
  resource_saturation: "자원 포화",
};
