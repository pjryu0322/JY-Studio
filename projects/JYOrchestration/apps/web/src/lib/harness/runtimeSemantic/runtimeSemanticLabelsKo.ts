/**
 * H17 — Overlay 한글 라벨(read-only).
 */

export const RUNTIME_SEMANTIC_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 orchestration runtime이 아니라 planning semantic compression 품질 진단 정보입니다.";

export const RUNTIME_SEMANTIC_COMPRESSION_QUALITY_LABEL_KO: Readonly<
  Record<"safe" | "watch" | "over_compressed" | "under_compressed", string>
> = {
  safe: "안전",
  watch: "주의",
  over_compressed: "과압축",
  under_compressed: "저압축",
};

export const RUNTIME_SEMANTIC_GROUP_BALANCE_LABEL_KO: Readonly<
  Record<"balanced" | "watch" | "imbalanced", string>
> = {
  balanced: "균형",
  watch: "주의",
  imbalanced: "불균형",
};

export const RUNTIME_SEMANTIC_GROUP_LABEL_KO: Readonly<Record<string, string>> = {
  governance: "거버넌스",
  lifecycle: "라이프사이클",
  dependency: "의존성",
  propagation: "전파",
  criticality: "크리티컬리티",
  coherence: "일관성",
  escalation: "에스컬레이션",
  other: "기타",
};
