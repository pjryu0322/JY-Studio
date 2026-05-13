import { describe, expect, it } from "vitest";

import {
  parseOverlayPruningCandidatesFromUnknown,
  suggestOverlayPruningCandidates,
  summarizeOverlayPruningCandidates,
} from "@/lib/overlay/overlayContextPruning";
import { buildOverlayContextAssemblyPlan } from "@/lib/overlay/overlayContextAssemblyPlan";
import { buildOverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import { buildOverlaySelectedContextRefs } from "@/lib/overlay/overlayContextSelection";

const refs = buildOverlaySelectedContextRefs({
  roleKey: "planner",
  memoryScopes: ["platform"],
  knowledgeHints: ["pack1"],
  timelineEnabled: true,
  workspaceScreenKey: "design.canvas",
  policyHintSource: "planner",
});

const highBudget = buildOverlayContextBudgetMetadata({
  promptLength: 80_000,
  selectedContextCount: refs.length,
});
const planHigh = buildOverlayContextAssemblyPlan({ selectedContextRefs: refs, budgetMetadata: highBudget });

describe("suggestOverlayPruningCandidates", () => {
  it("returns empty for overflowRisk=low", () => {
    const out = suggestOverlayPruningCandidates({ assemblyPlan: planHigh, overflowRisk: "low" });
    expect(out).toEqual([]);
  });

  it("returns candidates with reason prefix overflow_<risk>_<type> for high risk", () => {
    const out = suggestOverlayPruningCandidates({ assemblyPlan: planHigh, overflowRisk: "high" });
    expect(out.length).toBeGreaterThan(0);
    for (const c of out) {
      expect(c.reason.startsWith("overflow_high_")).toBe(true);
      expect(c.estimatedReduction).toBeGreaterThanOrEqual(1);
    }
  });

  it("summary aggregates count + total reduction", () => {
    const out = suggestOverlayPruningCandidates({ assemblyPlan: planHigh, overflowRisk: "high" });
    const s = summarizeOverlayPruningCandidates(out);
    expect(s.candidateCount).toBe(out.length);
    expect(s.totalEstimatedReduction).toBe(out.reduce((a, c) => a + c.estimatedReduction, 0));
  });
});

describe("parseOverlayPruningCandidatesFromUnknown", () => {
  it("filters invalid entries and clamps reduction", () => {
    const out = parseOverlayPruningCandidatesFromUnknown([
      { source: "x", reason: "y", estimatedReduction: -5 },
      { source: "", reason: "missing source", estimatedReduction: 10 },
      { source: "z", reason: "", estimatedReduction: 10 },
      null,
      "garbage",
    ]);
    expect(out.length).toBe(1);
    expect(out[0]).toEqual({ source: "x", reason: "y", estimatedReduction: 0 });
  });
});
