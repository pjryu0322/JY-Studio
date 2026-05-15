/**
 * H17 — Overlay 한글 라벨(read-only).
 */

export const RUNTIME_SEMANTIC_SECTION_DISCLAIMER_KO =
  "이 정보는 semantic planning observability 진단이며 actual orchestration trace가 아닙니다.";

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
