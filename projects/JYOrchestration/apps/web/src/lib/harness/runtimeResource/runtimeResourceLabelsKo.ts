/**
 * H20.5 — Overlay·resource intelligence 한글 라벨(read-only).
 */

export const RUNTIME_RESOURCE_SECTION_DISCLAIMER_KO =
  "이 정보는 planning runtime resource orchestration intelligence 진단이며 actual execution·provider switching은 없습니다.";

export const RUNTIME_RESOURCE_PRESSURE_LABEL_KO: Readonly<
  Record<
    | "token_pressure"
    | "provider_saturation"
    | "queue_overload"
    | "routing_congestion"
    | "parallel_execution_pressure"
    | "orchestration_congestion",
    string
  >
> = {
  token_pressure: "Token pressure",
  provider_saturation: "Provider saturation",
  queue_overload: "Queue overload",
  routing_congestion: "Routing congestion",
  parallel_execution_pressure: "Parallel execution pressure",
  orchestration_congestion: "Orchestration congestion",
};

export const RUNTIME_RESOURCE_CAPACITY_OUTLOOK_LABEL_KO: Readonly<
  Record<"comfortable" | "tight" | "strained" | "exhaustion_candidate", string>
> = {
  comfortable: "여유",
  tight: "타이트",
  strained: "압박",
  exhaustion_candidate: "고갈 후보",
};
