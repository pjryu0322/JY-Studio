/**
 * H15.5 — Overlay 한글 라벨(read-only).
 */

export const RUNTIME_CRITICALITY_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 orchestration priority가 아니라 planning 우선순위 진단 정보입니다.";

export function formatRuntimePlanningCriticalityScoreLabel(score: number): string {
  if (score >= 75) return "높음(메타)";
  if (score >= 45) return "중간(메타)";
  return "낮음(메타)";
}
