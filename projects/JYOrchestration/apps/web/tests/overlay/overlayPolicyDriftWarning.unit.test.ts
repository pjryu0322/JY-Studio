import { describe, expect, it } from "vitest";

import { detectOverlayPolicyDrift } from "@/lib/overlay/overlayPolicyDriftWarning";
import type { OverlayAssemblyPlanItem } from "@/lib/overlay/overlayContextAssemblyPlan";

function plan(items: ReadonlyArray<Partial<OverlayAssemblyPlanItem>>): OverlayAssemblyPlanItem[] {
  return items.map((i) => ({
    type: (i.type ?? "memory") as OverlayAssemblyPlanItem["type"],
    source: i.source ?? "src",
    priority: i.priority ?? 50,
    includeReason: i.includeReason ?? "reason",
    estimatedCost: i.estimatedCost ?? 10,
    pruningCandidate: i.pruningCandidate ?? false,
    includeMode: (i.includeMode ?? "optional") as OverlayAssemblyPlanItem["includeMode"],
  }));
}

describe("detectOverlayPolicyDrift", () => {
  it("flags compact policy with too many timeline items", () => {
    const warnings = detectOverlayPolicyDrift({
      assemblyPlan: plan([
        { type: "memory" },
        { type: "knowledge" },
        { type: "timeline", source: "t1" },
        { type: "timeline", source: "t2" },
      ]),
      budgetMetadata: {
        estimatedInputTokens: 100,
        estimatedOutputTokens: 30,
        budgetPolicy: "compact",
        overflowRisk: "low",
      },
    });
    expect(warnings.find((w) => w.code === "OVERLAY_DRIFT_COMPACT_TIMELINE_OVERLOAD")).toBeTruthy();
    for (const w of warnings) expect(w.enforcement).toBe("not_applied");
  });

  it("flags overflowRisk high without pruning candidates", () => {
    const warnings = detectOverlayPolicyDrift({
      assemblyPlan: plan([
        { type: "memory", pruningCandidate: false },
        { type: "knowledge", pruningCandidate: false },
      ]),
      budgetMetadata: {
        estimatedInputTokens: 100,
        estimatedOutputTokens: 30,
        budgetPolicy: "extended",
        overflowRisk: "high",
      },
    });
    expect(
      warnings.find((w) => w.code === "OVERLAY_DRIFT_OVERFLOW_HIGH_WITHOUT_PRUNING"),
    ).toBeTruthy();
  });

  it("emits info-level warnings when memory or knowledge scope is missing", () => {
    const warnings = detectOverlayPolicyDrift({
      assemblyPlan: plan([{ type: "policy" }, { type: "workspace" }]),
      budgetMetadata: null,
    });
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("OVERLAY_DRIFT_NO_MEMORY_SCOPE");
    expect(codes).toContain("OVERLAY_DRIFT_NO_KNOWLEDGE_SCOPE");
  });

  it("flags compact with too many optional timeline items (includeMode 기반)", () => {
    const warnings = detectOverlayPolicyDrift({
      assemblyPlan: plan([
        { type: "memory", includeMode: "recommended" },
        { type: "knowledge", includeMode: "recommended" },
        { type: "timeline", source: "t1", includeMode: "optional" },
        { type: "timeline", source: "t2", includeMode: "optional" },
      ]),
      budgetMetadata: {
        estimatedInputTokens: 100,
        estimatedOutputTokens: 30,
        budgetPolicy: "compact",
        overflowRisk: "low",
      },
    });
    expect(
      warnings.find((w) => w.code === "OVERLAY_DRIFT_COMPACT_OPTIONAL_TIMELINE_OVERLOAD"),
    ).toBeTruthy();
  });

  it("flags overflowRisk high without any excludeCandidate (includeMode 기반)", () => {
    const warnings = detectOverlayPolicyDrift({
      assemblyPlan: plan([
        { type: "memory", includeMode: "recommended" },
        { type: "knowledge", includeMode: "recommended" },
        { type: "timeline", includeMode: "optional" },
      ]),
      budgetMetadata: {
        estimatedInputTokens: 100,
        estimatedOutputTokens: 30,
        budgetPolicy: "extended",
        overflowRisk: "high",
      },
    });
    expect(
      warnings.find((w) => w.code === "OVERLAY_DRIFT_HIGH_OVERFLOW_WITHOUT_EXCLUDE_CANDIDATE"),
    ).toBeTruthy();
  });

  it("flags missing required item", () => {
    const warnings = detectOverlayPolicyDrift({
      assemblyPlan: plan([
        { type: "memory", includeMode: "recommended" },
        { type: "knowledge", includeMode: "recommended" },
      ]),
      budgetMetadata: null,
    });
    expect(warnings.find((w) => w.code === "OVERLAY_DRIFT_NO_REQUIRED_ITEM")).toBeTruthy();
  });

  it("returns empty list for empty plan", () => {
    expect(detectOverlayPolicyDrift({ assemblyPlan: [], budgetMetadata: null })).toEqual([]);
  });
});
