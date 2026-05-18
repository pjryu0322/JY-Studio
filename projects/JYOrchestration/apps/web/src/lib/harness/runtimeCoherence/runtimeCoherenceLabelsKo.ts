/**
 * H14 — Overlay 한글 라벨(read-only).
 */

import type {
  RuntimePlanningCoherenceLevel,
  RuntimePlanningDivergenceSeverity,
  RuntimePlanningSynchronizationState,
} from "./runtimeCoherenceTypes";

export const RUNTIME_COHERENCE_SECTION_DISCLAIMER_KO =
  "이 정보는 planning coherence·synchronization·divergence 진단 메타이며 실제 runtime orchestration이 아닙니다.";

export const RUNTIME_PLANNING_COHERENCE_LABEL_KO: Record<RuntimePlanningCoherenceLevel, string> = {
  aligned: "정합",
  partial: "부분 정합",
  misaligned: "불일치",
};

export const RUNTIME_PLANNING_SYNCHRONIZATION_LABEL_KO: Record<RuntimePlanningSynchronizationState, string> = {
  synchronized: "동기화됨(메타)",
  lagging: "지연",
  desynchronized: "비동기",
};

export const RUNTIME_PLANNING_DIVERGENCE_SEVERITY_LABEL_KO: Record<RuntimePlanningDivergenceSeverity, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};
