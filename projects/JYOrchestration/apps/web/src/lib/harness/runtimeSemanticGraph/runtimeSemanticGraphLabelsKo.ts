/**
 * H18 — Overlay 한글 라벨(read-only).
 */

export const RUNTIME_SEMANTIC_GRAPH_SECTION_DISCLAIMER_KO =
  "이 정보는 planning semantic explainability graph 진단이며 actual orchestration runtime이 아닙니다.";

export const RUNTIME_SEMANTIC_EXPLOSION_RISK_LABEL_KO: Readonly<
  Record<"low" | "medium" | "high", string>
> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};
