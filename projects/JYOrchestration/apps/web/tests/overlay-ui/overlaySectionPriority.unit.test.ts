import { describe, expect, it } from "vitest";

import { resolveOverlaySectionPriority } from "@/lib/overlay-ui/overlaySectionPriority";

describe("resolveOverlaySectionPriority", () => {
  it("marks warnings and execution routing as critical", () => {
    expect(resolveOverlaySectionPriority("warning")).toBe("critical");
    expect(resolveOverlaySectionPriority("execution_routing")).toBe("critical");
  });

  it("marks maturity and operator summary as important", () => {
    expect(resolveOverlaySectionPriority("maturity_baseline")).toBe("important");
    expect(resolveOverlaySectionPriority("operator_runtime_summary")).toBe("important");
    expect(resolveOverlaySectionPriority("operator_resource_summary")).toBe("important");
  });

  it("marks runtime trial as normal priority", () => {
    expect(resolveOverlaySectionPriority("runtime_trial")).toBe("normal");
  });

  it("marks runtime governance as normal priority", () => {
    expect(resolveOverlaySectionPriority("runtime_governance")).toBe("normal");
  });

  it("marks runtime enforcement candidate as normal priority", () => {
    expect(resolveOverlaySectionPriority("runtime_enforcement_candidate")).toBe("normal");
  });

  it("marks controlled enforcement governance as normal priority", () => {
    expect(resolveOverlaySectionPriority("controlled_enforcement_governance")).toBe("normal");
    expect(resolveOverlaySectionPriority("runtime_stability")).toBe("important");
    expect(resolveOverlaySectionPriority("runtime_priority")).toBe("important");
  });

  it("marks resource orchestration as normal priority", () => {
    expect(resolveOverlaySectionPriority("resource_orchestration")).toBe("normal");
  });

  it("marks raw assembly / pruning / harness preview as internal (same compact policy as advanced)", () => {
    expect(resolveOverlaySectionPriority("assembly_plan")).toBe("internal");
    expect(resolveOverlaySectionPriority("pruning")).toBe("internal");
    expect(resolveOverlaySectionPriority("harness_prompt_preview")).toBe("internal");
  });
});
