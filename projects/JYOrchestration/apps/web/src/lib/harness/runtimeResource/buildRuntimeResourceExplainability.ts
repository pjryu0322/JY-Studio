/**
 * H20.5 — resource **causal explainability**(read-only, deduped chain).
 */

import type {
  RuntimeMemberWorkload,
  RuntimeResourceExplainability,
  RuntimeResourcePressure,
} from "./runtimeResourceTypes";

const CANONICAL_CHAIN =
  "routing concentration → provider saturation → queue pressure → orchestration instability";

export function buildRuntimeResourceExplainability(
  pressures: readonly RuntimeResourcePressure[],
  workload: RuntimeMemberWorkload
): RuntimeResourceExplainability {
  const top = pressures[0];
  const findings: string[] = [];

  if (top && top.severity !== "low") {
    findings.push(`${top.labelKo}: ${top.noteKo}`);
  }
  if (workload.members.some((m) => m.workloadLevel === "saturated")) {
    findings.push("특정 AI member saturation이 routing concentration을 유발할 수 있습니다.");
  }
  if (findings.length === 0) {
    findings.push("resource explainability — stable planning 경로");
  }

  let causalChainKo = CANONICAL_CHAIN;
  if (top?.kind === "token_pressure") {
    causalChainKo = "token pressure → compression stress → queue backlog → orchestration instability";
  } else if (top?.kind === "provider_saturation") {
    causalChainKo = CANONICAL_CHAIN;
  }

  return {
    mode: "runtime_resource_explainability",
    actualRuntimeOrchestrationEnabled: false,
    causalChainKo,
    findings: findings.slice(0, 4),
  };
}

export function serializeRuntimeResourceExplainabilityForDiagnostic(
  explainability: RuntimeResourceExplainability
): Readonly<Record<string, unknown>> {
  return {
    mode: explainability.mode,
    actualRuntimeOrchestrationEnabled: explainability.actualRuntimeOrchestrationEnabled,
    causalChainKo: explainability.causalChainKo,
    findings: [...explainability.findings],
  };
}
