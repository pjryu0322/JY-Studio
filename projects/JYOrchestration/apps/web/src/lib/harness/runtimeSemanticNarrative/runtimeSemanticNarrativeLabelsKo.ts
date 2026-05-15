/**
 * H18.5 — Overlay·narrative 한글 라벨(read-only).
 */

export const RUNTIME_SEMANTIC_NARRATIVE_SECTION_DISCLAIMER_KO =
  "이 정보는 planning semantic narrative 진단이며 actual orchestration runtime이 아닙니다.";

export const RUNTIME_SEMANTIC_NARRATIVE_SEVERITY_LABEL_KO: Readonly<
  Record<"info" | "watch" | "critical_candidate", string>
> = {
  info: "정보",
  watch: "관찰",
  critical_candidate: "중요 후보",
};

export const RUNTIME_SEMANTIC_ROOT_CAUSE_KIND_LABEL_KO: Readonly<
  Record<
    | "dependency_conflict"
    | "propagation_escalation"
    | "governance_conflict"
    | "hidden_trace"
    | "compression_quality"
    | "group_imbalance"
    | "reasoning_explosion"
    | "stable_planning",
    string
  >
> = {
  dependency_conflict: "Dependency 충돌",
  propagation_escalation: "Propagation escalation",
  governance_conflict: "Governance 충돌",
  hidden_trace: "숨김 trace",
  compression_quality: "압축 품질",
  group_imbalance: "Group 불균형",
  reasoning_explosion: "Reasoning explosion",
  stable_planning: "안정 planning",
};
