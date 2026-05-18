/**
 * H13.5 — Overlay 한글 라벨(read-only).
 */

import type {
  RuntimePlanningDriftSeverity,
  RuntimePlanningFreshness,
  RuntimePlanningLifecycleState,
} from "./runtimeLifecycleTypes";

export const RUNTIME_LIFECYCLE_SECTION_DISCLAIMER_KO =
  "이 정보는 planning lifecycle·freshness·drift 진단 메타이며 실제 runtime orchestration이 아닙니다.";

export const RUNTIME_PLANNING_FRESHNESS_LABEL_KO: Record<RuntimePlanningFreshness, string> = {
  fresh: "신선",
  aging: "노후화",
  stale: "오래됨",
};

export const RUNTIME_PLANNING_LIFECYCLE_STATE_LABEL_KO: Record<RuntimePlanningLifecycleState, string> = {
  active: "활성(메타)",
  watch: "주시",
  stale: "오래됨",
  invalidated: "무효화 후보",
};

export const RUNTIME_PLANNING_DRIFT_SEVERITY_LABEL_KO: Record<RuntimePlanningDriftSeverity, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};
