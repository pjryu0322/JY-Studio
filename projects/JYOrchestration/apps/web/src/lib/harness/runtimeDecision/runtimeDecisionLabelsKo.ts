/**
 * H19.5 — Overlay·decision 한글 라벨(read-only).
 */

export const RUNTIME_DECISION_SECTION_DISCLAIMER_KO =
  "이 정보는 planning runtime decision intelligence 진단이며 actual orchestration·execution은 없습니다.";

export const RUNTIME_RECOMMENDATION_LABEL_KO: Readonly<
  Record<
    | "stabilize_memory_scope"
    | "reduce_semantic_explosion"
    | "governance_review"
    | "routing_ambiguity"
    | "maintain_stable_planning",
    string
  >
> = {
  stabilize_memory_scope: "memory scope 안정화 우선(메타)",
  reduce_semantic_explosion: "semantic explosion 완화(메타)",
  governance_review: "governance review 권장(메타)",
  routing_ambiguity: "routing ambiguity 점검(메타)",
  maintain_stable_planning: "현재 stable planning 유지(메타)",
};

export const RUNTIME_DECISION_COHERENCE_LEVEL_LABEL_KO: Readonly<
  Record<"aligned" | "partial" | "divergent", string>
> = {
  aligned: "정렬됨",
  partial: "부분 정렬",
  divergent: "불일치",
};
