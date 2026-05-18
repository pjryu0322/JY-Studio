import { describe, expect, it } from "vitest";

import { buildRuntimeSimulationSummary, serializeRuntimeSimulationSummaryForDiagnostic } from "@/lib/harness/runtimeTrial/buildRuntimeSimulationSummary";

describe("buildRuntimeSimulationSummary", () => {
  it("returns dry-run metadata with all actions disabled", () => {
    const s = buildRuntimeSimulationSummary();
    expect(s.mode).toBe("dry_run_simulation_metadata_only");
    expect(s.simulatedActions.every((a) => a.wouldOccur === false)).toBe(true);
    expect(s.disclaimerKo.length).toBeGreaterThan(20);
  });

  it("serializeRuntimeSimulationSummaryForDiagnostic preserves wire shape", () => {
    const s = buildRuntimeSimulationSummary();
    const w = serializeRuntimeSimulationSummaryForDiagnostic(s);
    expect(w.mode).toBe(s.mode);
    expect(w.disclaimerKo).toBe(s.disclaimerKo);
    expect(w.simulatedActions).toHaveLength(s.simulatedActions.length);
    expect(w.simulatedActions.every((a) => a.wouldOccur === false)).toBe(true);
  });
});
