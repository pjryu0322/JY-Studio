import { describe, expect, it } from "vitest";
import { buildProjectAgentUnresolvedDiagnosticWarnings } from "@/lib/overlay/overlayPolicyWarning";
import { buildProjectOverlayDiagnosticFromSelectedAgents } from "@/lib/overlay/overlayProjectDiagnostic";

describe("buildProjectOverlayDiagnosticFromSelectedAgents", () => {
  it("splits resolved vs unresolved and aggregates provider/capability counts", () => {
    const d = buildProjectOverlayDiagnosticFromSelectedAgents("p1", [
      {
        source: "catalog",
        catalogKey: "ideation",
        displayName: "Ideation",
        aiOrchestrationRole: "planner",
        orchestrationStage: "spec",
        aiProvider: "openai",
        aiAgentKey: null,
        aiModelOverride: null,
        enginePreference: null,
      },
      {
        source: "project_member",
        catalogKey: undefined,
        displayName: "Ghost",
        aiOrchestrationRole: "__no_such_overlay_role__",
        orchestrationStage: "spec",
        aiProvider: "openai",
        aiAgentKey: null,
        aiModelOverride: null,
        enginePreference: null,
      },
    ]);
    expect(d.resolvedAgents.length).toBe(1);
    expect(d.unresolvedAgents.length).toBe(1);
    expect(d.providerCounts["openai"]).toBeGreaterThanOrEqual(1);
    expect(d.selectedAgentCount).toBe(2);
    expect(Object.keys(d.capabilityCounts).length).toBeGreaterThanOrEqual(1);
  });

  it("buildProjectAgentUnresolvedDiagnosticWarnings targets unresolved rows", () => {
    const rows = buildProjectAgentUnresolvedDiagnosticWarnings([
      {
        catalogKey: "x",
        aiOrchestrationRole: "__bad__",
        displayName: "U1",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.code).toBe("OVERLAY_PROJECT_AGENT_UNRESOLVED");
    expect(rows[0]?.message).toContain("U1");
    expect(rows[0]?.enforcement).toBe("not_applied");
  });
});
