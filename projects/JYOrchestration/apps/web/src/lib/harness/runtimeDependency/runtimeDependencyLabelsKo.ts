/**
 * H15 — Overlay 한글 라벨(read-only).
 */

import type { RuntimePlanningDependencyConflictSeverity, RuntimePlanningGraphNodeStatus } from "./runtimeDependencyTypes";

export const RUNTIME_DEPENDENCY_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 orchestration graph가 아니라 planning relationship 진단 정보입니다.";

export const RUNTIME_PLANNING_GRAPH_NODE_STATUS_LABEL_KO: Record<RuntimePlanningGraphNodeStatus, string> = {
  healthy: "정상(메타)",
  watch: "주시",
  degraded: "저하",
  isolated: "고립",
};

export const RUNTIME_PLANNING_DEPENDENCY_CONFLICT_SEVERITY_LABEL_KO: Record<
  RuntimePlanningDependencyConflictSeverity,
  string
> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};
