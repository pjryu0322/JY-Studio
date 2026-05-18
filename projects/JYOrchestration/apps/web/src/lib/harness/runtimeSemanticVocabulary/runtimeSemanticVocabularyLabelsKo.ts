/**
 * H19 — Vocabulary·overlay 한글 라벨(read-only).
 */

export const RUNTIME_SEMANTIC_VOCABULARY_SECTION_DISCLAIMER_KO =
  "이 정보는 planning semantic vocabulary 정규화 진단이며 actual orchestration runtime이 아닙니다.";

export const RUNTIME_SEMANTIC_CANONICAL_LABEL_KO: Readonly<Record<string, string>> = {
  governance_hidden_trace: "거버넌스 숨김 trace",
  hidden_critical_transition: "숨김 critical transition",
  semantic_compression: "Semantic 압축",
  compression_quality: "압축 품질",
  propagation_escalation: "Propagation escalation",
  dependency_conflict: "Dependency 충돌",
  reasoning_explosion: "Reasoning explosion",
  group_imbalance: "Group 불균형",
  semantic_explosion: "Semantic explosion",
  dependency_saturation: "Dependency 포화",
  stale_runtime: "Stale runtime",
  stable_planning: "안정 planning",
  warning_origin: "Warning origin",
  causal_path: "Causal path",
};

export const RUNTIME_SEMANTIC_PRIORITY_LABEL_KO: Readonly<
  Record<
    | "governance_criticality"
    | "semantic_explosion"
    | "hidden_trace"
    | "dependency_saturation"
    | "propagation_escalation"
    | "stale_runtime"
    | "stable_planning",
    string
  >
> = {
  governance_criticality: "거버넌스 criticality",
  semantic_explosion: "Semantic explosion",
  hidden_trace: "숨김 trace",
  dependency_saturation: "Dependency 포화",
  propagation_escalation: "Propagation escalation",
  stale_runtime: "Stale runtime",
  stable_planning: "안정 planning",
};
