/**
 * H20.5 — **Provider pressure** 해석(read-only; planning metadata·기존 pressure 참조만).
 */

import type { RuntimeProviderPressure, RuntimeResourcePressure } from "./runtimeResourceTypes";

export function evaluateRuntimeProviderPressure(
  pressures: readonly RuntimeResourcePressure[]
): RuntimeProviderPressure {
  const p = pressures.find((x) => x.kind === "provider_saturation");
  const severity = p?.severity ?? "low";
  return {
    mode: "runtime_provider_pressure",
    actualRuntimeOrchestrationEnabled: false,
    severity,
    summaryKo: p ? `${p.labelKo}: ${p.noteKo}` : "provider pressure 신호 낮음 — quota·API 호출 없음",
  };
}
