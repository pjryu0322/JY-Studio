import { describe, expect, it } from "vitest";

import { analyzeRuntimeResourcePressure } from "@/lib/harness/runtimeResource/analyzeRuntimeResourcePressure";
import { evaluateRuntimeBottleneckPropagation } from "@/lib/harness/runtimeResource/evaluateRuntimeBottleneckPropagation";
import { evaluateRuntimeProviderPressure } from "@/lib/harness/runtimeResource/evaluateRuntimeProviderPressure";
import { evaluateRuntimeQueuePressure } from "@/lib/harness/runtimeResource/evaluateRuntimeQueuePressure";
import { serializeRuntimeResourceDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeResource/serializeRuntimeResourceDiagnosticBundle";
import type { RuntimeResourcePressure } from "@/lib/harness/runtimeResource/runtimeResourceTypes";
import { buildResourcePlanningTestFixtures } from "./resourceTestFixtures";

describe("H20.5 runtime resource evaluators", () => {
  it("evaluateRuntimeProviderPressure mirrors provider_saturation pressure or low default", () => {
    const empty = evaluateRuntimeProviderPressure([]);
    expect(empty.mode).toBe("runtime_provider_pressure");
    expect(empty.severity).toBe("low");
    expect(empty.summaryKo).toContain("provider pressure");

    const pressures: RuntimeResourcePressure[] = [
      {
        kind: "provider_saturation",
        severity: "high",
        labelKo: "Provider",
        noteKo: "busy",
      },
    ];
    const hi = evaluateRuntimeProviderPressure(pressures);
    expect(hi.severity).toBe("high");
    expect(hi.summaryKo).toContain("Provider");
    expect(hi.summaryKo).toContain("busy");
  });

  it("evaluateRuntimeQueuePressure returns bounded amplification and summary", () => {
    const { semantic } = buildResourcePlanningTestFixtures();
    const pressures = analyzeRuntimeResourcePressure(semantic);
    const q = evaluateRuntimeQueuePressure(semantic, pressures);
    expect(q.mode).toBe("runtime_queue_pressure");
    expect(["low", "medium", "high"]).toContain(q.amplificationLevel);
    expect(q.summaryKo.length).toBeGreaterThan(0);
  });

  it("evaluateRuntimeBottleneckPropagation returns propagation severity and chain copy", () => {
    const { semantic } = buildResourcePlanningTestFixtures();
    const b = evaluateRuntimeBottleneckPropagation(semantic);
    expect(b.mode).toBe("runtime_bottleneck_propagation");
    expect(["low", "medium", "high", "critical_candidate"]).toContain(b.propagationSeverity);
    expect(b.bottleneckChainKo.length).toBeGreaterThan(0);
    expect(b.slowdownRiskKo.length).toBeGreaterThan(0);
  });

  it("serializeRuntimeResourceDiagnosticBundleFromSemanticReports exposes summary keys without rebuild", () => {
    const { semantic } = buildResourcePlanningTestFixtures();
    const bundle = serializeRuntimeResourceDiagnosticBundleFromSemanticReports(semantic);
    expect(Object.keys(bundle).sort()).toEqual(
      [
        "runtimeMemberWorkload",
        "runtimeResourceCapacity",
        "runtimeResourceExplainability",
        "runtimeResourceForecast",
        "runtimeResourceSummary",
      ].sort()
    );
    const summary = bundle.runtimeResourceSummary as Record<string, unknown>;
    expect(summary).toMatchObject({ mode: "runtime_resource_summary" });
    expect(summary.providerPressure).toBeDefined();
    expect(summary.queuePressureInsight).toBeDefined();
    expect(summary.bottleneckPropagation).toBeDefined();
  });
});
