/**
 * H20.5 — resource summary·saturation·queue(read-only).
 */

import type {
  RuntimeBottleneckPropagation,
  RuntimeProviderPressure,
  RuntimeQueuePressure,
  RuntimeResourcePressure,
  RuntimeResourceQueue,
  RuntimeResourceSaturation,
  RuntimeResourceSummary,
} from "./runtimeResourceTypes";

function buildSaturation(pressures: readonly RuntimeResourcePressure[]): RuntimeResourceSaturation {
  const provider = pressures.find((p) => p.kind === "provider_saturation");
  const queue = pressures.find((p) => p.kind === "queue_overload");
  const providerLevel = provider?.severity ?? "low";
  const queueLevel = queue?.severity ?? "low";
  const primary =
    providerLevel !== "low"
      ? `provider saturation ${providerLevel}`
      : queueLevel !== "low"
        ? `queue saturation ${queueLevel}`
        : "saturation 신호 미약";

  return {
    mode: "runtime_resource_saturation",
    actualRuntimeOrchestrationEnabled: false,
    providerSaturationLevel: providerLevel,
    queueSaturationLevel: queueLevel,
    primarySaturationKo: primary,
  };
}

function buildQueue(pressures: readonly RuntimeResourcePressure[]): RuntimeResourceQueue {
  const queue = pressures.find((p) => p.kind === "queue_overload");
  return {
    mode: "runtime_resource_queue",
    actualRuntimeOrchestrationEnabled: false,
    queueDepthLabel: queue && queue.severity !== "low" ? "elevated" : "normal",
    overloadRiskKo: queue?.noteKo ?? "queue overload risk 낮음",
  };
}

export function buildRuntimeResourceSummary(
  pressures: readonly RuntimeResourcePressure[],
  insight: Readonly<{
    providerPressure: RuntimeProviderPressure;
    queuePressureInsight: RuntimeQueuePressure;
    bottleneckPropagation: RuntimeBottleneckPropagation;
  }>
): RuntimeResourceSummary {
  const top = pressures[0];
  return {
    mode: "runtime_resource_summary",
    actualRuntimeOrchestrationEnabled: false,
    pressures,
    overloadSummaryKo: top && top.severity !== "low" ? top.labelKo : "overload summary stable",
    primaryPressureKo: top?.labelKo ?? "Planning resource pressure 낮음",
    saturation: buildSaturation(pressures),
    queue: buildQueue(pressures),
    providerPressure: insight.providerPressure,
    queuePressureInsight: insight.queuePressureInsight,
    bottleneckPropagation: insight.bottleneckPropagation,
  };
}

export function serializeRuntimeResourceSummaryForDiagnostic(
  summary: RuntimeResourceSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    pressures: summary.pressures.map((p) => ({ ...p })),
    overloadSummaryKo: summary.overloadSummaryKo,
    primaryPressureKo: summary.primaryPressureKo,
    saturation: { ...summary.saturation },
    queue: { ...summary.queue },
    providerPressure: { ...summary.providerPressure },
    queuePressureInsight: { ...summary.queuePressureInsight },
    bottleneckPropagation: { ...summary.bottleneckPropagation },
  };
}
