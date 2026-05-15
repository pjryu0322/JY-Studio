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
  });

  it("marks harness preview as advanced", () => {
    expect(resolveOverlaySectionPriority("harness_prompt_preview")).toBe("advanced");
  });
});
