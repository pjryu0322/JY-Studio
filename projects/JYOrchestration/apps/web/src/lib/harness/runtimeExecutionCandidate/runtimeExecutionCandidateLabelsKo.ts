/**
 * H23 — Overlay·진단용 한국어 라벨(read-only).
 */

import type {
  RuntimeExecutionCandidateRisk,
  RuntimeExecutionCandidateStatus,
} from "./runtimeExecutionCandidateTypes";

export const RUNTIME_EXECUTION_CANDIDATE_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 orchestration 실행이 아니라, 향후 runtime 후보 경로를 설명하는 read-only execution candidate metadata입니다.";

export const RUNTIME_EXECUTION_CANDIDATE_STATUS_LABEL_KO: Record<RuntimeExecutionCandidateStatus, string> = {
  not_candidate: "실행 후보 아님(메타)",
  metadata_candidate: "메타데이터 후보만(실행 아님)",
  operator_review_required: "운영자 검토 메타 필요(실행 아님)",
  blocked: "후보 경로 차단(메타)",
};

export const RUNTIME_EXECUTION_CANDIDATE_RISK_LABEL_KO: Record<RuntimeExecutionCandidateRisk, string> = {
  stable: "안정(메타)",
  watch: "주시(메타)",
  elevated: "상향(메타)",
  blocked: "차단(메타)",
};
