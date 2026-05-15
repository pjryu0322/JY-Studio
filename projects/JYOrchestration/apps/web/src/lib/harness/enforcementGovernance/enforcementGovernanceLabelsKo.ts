/**
 * H11.5 — Overlay 한글 라벨(read-only).
 */

import type { EnforcementGovernanceMode, GovernanceRiskSummaryLevel } from "./controlledEnforcementGovernanceTypes";

export const ENFORCEMENT_GOVERNANCE_MODE_LABEL_KO: Record<EnforcementGovernanceMode, string> = {
  disabled: "거버넌스 기반 후보 비활성",
  candidate_only: "조건 충족 시 후보만(적용 아님)",
  planning_only: "계획·문서 단계만",
};

export const GOVERNANCE_RISK_SUMMARY_LEVEL_LABEL_KO: Record<GovernanceRiskSummaryLevel, string> = {
  stable: "안정",
  watch: "주시",
  elevated: "상승",
  high: "높음",
};

export const CONTROLLED_ENFORCEMENT_GOVERNANCE_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 enforcement가 아니라 governance 조건 기반 후보 readiness를 보여주는 read-only 진단 정보입니다.";
