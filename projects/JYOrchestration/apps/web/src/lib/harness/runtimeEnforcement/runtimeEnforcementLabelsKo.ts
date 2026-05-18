/**
 * H11 — Overlay 한글 라벨(read-only).
 */

import type { EnforcementCandidateMode, EnforcementCandidateRisk, EnforcementRiskSummaryLevel } from "./runtimeEnforcementCandidateTypes";

export const ENFORCEMENT_CANDIDATE_MODE_LABEL_KO: Record<EnforcementCandidateMode, string> = {
  disabled: "후보 비활성(조건 미충족)",
  candidate_only: "후보만 표시(적용 아님)",
  planning_only: "계획·문서 단계만",
};

export const ENFORCEMENT_CANDIDATE_RISK_LABEL_KO: Record<EnforcementCandidateRisk, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

export const ENFORCEMENT_RISK_SUMMARY_LEVEL_LABEL_KO: Record<EnforcementRiskSummaryLevel, string> = {
  stable: "안정",
  watch: "주시",
  elevated: "상승",
  high: "높음",
};

export const RUNTIME_ENFORCEMENT_CANDIDATE_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 runtime enforcement가 아니라 향후 적용 가능한 후보 capability를 보여주는 read-only 진단 정보입니다.";
