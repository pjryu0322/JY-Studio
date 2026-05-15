/**
 * H20 — Overlay·forecast 한글 라벨(read-only).
 */

export const RUNTIME_FORECAST_SECTION_DISCLAIMER_KO =
  "이 정보는 planning runtime forecasting 진단이며 actual orchestration·execution·remediation은 없습니다.";

export const RUNTIME_FORECAST_TREND_LABEL_KO: Readonly<
  Record<
    | "semantic_growth"
    | "governance_drift"
    | "warning_amplification"
    | "routing_instability"
    | "lifecycle_fragmentation",
    string
  >
> = {
  semantic_growth: "Semantic growth",
  governance_drift: "Governance drift",
  warning_amplification: "Warning amplification",
  routing_instability: "Routing instability",
  lifecycle_fragmentation: "Lifecycle fragmentation",
};

export const RUNTIME_FORECAST_STABILITY_OUTLOOK_LABEL_KO: Readonly<
  Record<"stable" | "watch" | "degrading" | "critical_candidate", string>
> = {
  stable: "안정 전망",
  watch: "관찰 필요",
  degrading: "저하 가능",
  critical_candidate: "임계 후보",
};
