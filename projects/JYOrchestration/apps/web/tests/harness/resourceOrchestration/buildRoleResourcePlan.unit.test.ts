import { describe, expect, it } from "vitest";

import { buildRoleResourcePlan } from "@/lib/harness/resourceOrchestration/buildRoleResourcePlan";

describe("buildRoleResourcePlan", () => {
  it("returns conservative defaults for unknown roles", () => {
    const p = buildRoleResourcePlan({ roleKey: "non-existent-role-xyz" });
    expect(p.resolvedContractRoleKey).toBeNull();
    expect(p.retrievalStance).toBe("balanced");
    expect(p.planningDisclaimer.length).toBeGreaterThan(10);
  });

  it("resolves planner contract and balanced retrieval without knowledge_retrieval", () => {
    const p = buildRoleResourcePlan({ roleKey: "planner" });
    expect(p.resolvedContractRoleKey).toBe("planner");
    expect(p.retrievalStance).toBe("balanced");
  });

  it("expands retrieval stance for domain-expert (knowledge_retrieval)", () => {
    const p = buildRoleResourcePlan({ roleKey: "domain-expert" });
    expect(p.resolvedContractRoleKey).toBe("domain-expert");
    expect(p.retrievalStance).toBe("expanded");
  });

  it("uses cursor-specific hints for prototype_build", () => {
    const p = buildRoleResourcePlan({ roleKey: "prototype_build" });
    expect(p.resolvedContractRoleKey).toBe("prototype_build");
    expect(p.providerPlanLabel).toContain("Cursor");
    expect(p.memoryStance).toBe("expanded");
  });
});
