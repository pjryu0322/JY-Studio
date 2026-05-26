import { describe, expect, it } from "vitest";
import { buildRequirementsPromptTimelineDebugEntryId } from "@/lib/debug/requirementsPromptTimelineDebugEntry";

const at = "2026-05-26T11:32:53.024Z";

describe("requirementsPromptTimelineDebugEntry", () => {
  it("assigns unique ids for quick design confirm implementation traces at the same timestamp", () => {
    const actions = [
      "quick_design_confirmed",
      "quick_design_confirmed_implementation_seed_auto_built",
      "quick_design_confirmed_implementation_readiness_evaluated",
      "quick_design_confirmed_implementation_candidates_auto_generated",
    ] as const;
    const ids = actions.map((action, ordinal) =>
      buildRequirementsPromptTimelineDebugEntryId({ createdAt: at, action, ordinal }),
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).not.toBe(`req_20260526T113253024Z_quick_design_confirmed_i`);
    }
  });
});
