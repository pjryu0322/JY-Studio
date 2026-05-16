/**
 * H24 — Overlay·진단용 한국어 라벨(read-only).
 */

import type {
  RuntimeControlledPilotReadiness,
  RuntimeControlledPilotScope,
} from "./runtimeControlledPilotTypes";

export const RUNTIME_CONTROLLED_PILOT_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 runtime pilot 실행이 아니라, controlled pilot 후보 범위와 안전 경계를 설명하는 read-only metadata입니다.";

export const RUNTIME_CONTROLLED_PILOT_READINESS_LABEL_KO: Record<RuntimeControlledPilotReadiness, string> = {
  not_ready: "controlled pilot 메타 미준비",
  metadata_ready: "단일 flow pilot 후보 메타(실행 없음)",
  watch: "pilot 후보 메타 주시(실행 없음)",
  blocked: "pilot 후보 메타 차단(실행 없음)",
};

export const RUNTIME_CONTROLLED_PILOT_SCOPE_LABEL_KO: Record<RuntimeControlledPilotScope, string> = {
  none: "pilot 스코프 없음(메타)",
  single_flow_metadata: "단일 flow 메타 범위만(실행 없음)",
  diagnostic_only: "진단 전용 메타 범위(실행 없음)",
  blocked: "pilot 스코프 차단(메타)",
};
