/**
 * H12.5 — Overlay 한글 라벨(read-only).
 */

import type { RuntimeEscalationLevel, RuntimePlanningPriority } from "./runtimePriorityTypes";

export const RUNTIME_PRIORITY_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 runtime orchestration이 아니라 planning 우선순위 및 안정성 진단 정보입니다.";

export const RUNTIME_PLANNING_PRIORITY_LABEL_KO: Record<RuntimePlanningPriority, string> = {
  critical: "긴급",
  high: "높음",
  medium: "중간",
  low: "낮음",
};

export const RUNTIME_ESCALATION_LEVEL_LABEL_KO: Record<RuntimeEscalationLevel, string> = {
  none: "없음",
  watch: "주시",
  escalated: "에스컬레이션",
  critical: "긴급",
};
