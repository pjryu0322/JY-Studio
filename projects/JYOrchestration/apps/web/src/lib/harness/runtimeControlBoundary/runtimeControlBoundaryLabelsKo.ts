/** H22.5 — Overlay·문서용 한글 라벨·면책. */

import type { RuntimeControlBoundaryLevel, RuntimeControlBoundaryRisk } from "./runtimeControlBoundaryTypes";

export const RUNTIME_CONTROL_BOUNDARY_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 runtime control이 아니라, read-only/planning/dry-run/actual-control 경계를 설명하는 metadata입니다.";

export const RUNTIME_CONTROL_BOUNDARY_LEVEL_LABEL_KO: Readonly<Record<RuntimeControlBoundaryLevel, string>> = {
  read_only: "Read-only (관측·진단 메타만)",
  planning_metadata: "Planning metadata (실행·할당 신호 없음)",
  dry_run_metadata: "Dry-run metadata (실제 trial·할당 없음)",
  execution_candidate_metadata: "Execution candidate metadata (H23 이전 후보만; 실제 orchestration 없음)",
  actual_control_forbidden: "Actual control 금지 구간 (governance·trial 차단 메타)",
};

export const RUNTIME_CONTROL_BOUNDARY_RISK_LABEL_KO: Readonly<Record<RuntimeControlBoundaryRisk, string>> = {
  stable: "경계 안정",
  watch: "경계 watch",
  violation_candidate: "경계 위반 후보(메타 점검)",
  blocked: "경계 차단(메타)",
};
