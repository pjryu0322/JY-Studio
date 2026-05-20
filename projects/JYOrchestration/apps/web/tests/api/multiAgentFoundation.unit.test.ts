import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONNECTORS,
  assertDefaultAgentRegistryValid,
  getAgentById,
  getAllAgents,
  getAllCapabilities,
  getAllConnectors,
  getCapabilitiesForAgent,
  getConnectorById,
  getCapabilityById,
  isConnectorEnabledForExecution,
  listAgents,
  listCapabilities,
  mapAiMemberRoleToAgentId,
  mapRequirementIntentToPrimaryAgentId,
  mapWorkspaceAiMemberToAgentId,
  validateAgentCapabilityBinding,
  validateDefaultAgentRegistry,
  WORKSPACE_AI_MEMBER_TO_AGENT_ID,
  resolveAgentDefinitionForWorkspaceMember,
} from "@/lib/agents";

describe("multi-agent foundation stage 1", () => {
  it("registry lists are non-empty via public API", () => {
    expect(getAllAgents().length).toBeGreaterThan(0);
    expect(getAllCapabilities().length).toBeGreaterThan(0);
    expect(listAgents().length).toBe(getAllAgents().length);
  });

  it("every agent defaultCapability exists in registry", () => {
    for (const agent of getAllAgents()) {
      for (const capId of agent.defaultCapabilities) {
        expect(getCapabilityById(capId), `${agent.id}:${capId}`).toBeDefined();
      }
    }
  });

  it("capability allowedAgentTypes includes assigned agents", () => {
    for (const agent of getAllAgents()) {
      for (const capId of agent.defaultCapabilities) {
        const cap = getCapabilityById(capId)!;
        if (cap.allowedAgentTypes?.length) {
          expect(cap.allowedAgentTypes).toContain(agent.type);
        }
      }
    }
  });

  it("requiredConnectors are subset of agent allowedConnectors", () => {
    const issues = validateDefaultAgentRegistry();
    expect(issues.filter((i) => i.code === "missing_connector")).toHaveLength(0);
  });

  it("assertDefaultAgentRegistryValid passes", () => {
    expect(() => assertDefaultAgentRegistryValid()).not.toThrow();
  });

  it("getAgentById resolves ai-planner", () => {
    expect(getAgentById("ai-planner")?.name).toContain("기획");
  });

  it("getCapabilityById resolves project.idea.structure", () => {
    expect(getCapabilityById("project.idea.structure")?.category).toBe("planning");
  });

  it("getCapabilitiesForAgent matches agent defaultCapabilities", () => {
    const caps = getCapabilitiesForAgent("ai-developer");
    const ids = caps.map((c) => c.id);
    expect(ids).toEqual(getAgentById("ai-developer")!.defaultCapabilities);
  });

  it("validateAgentCapabilityBinding accepts valid binding", () => {
    expect(validateAgentCapabilityBinding("ai-developer", "cursor.implementation.plan")).toBe(true);
    expect(validateAgentCapabilityBinding("ai-planner", "project.idea.structure")).toBe(true);
  });

  it("validateAgentCapabilityBinding rejects invalid binding", () => {
    expect(validateAgentCapabilityBinding("ai-planner", "cursor.implementation.plan")).toBe(false);
    expect(validateAgentCapabilityBinding("nonexistent", "project.idea.structure")).toBe(false);
    expect(validateAgentCapabilityBinding("ai-planner", "nonexistent")).toBe(false);
  });

  it("AI member bridge maps ideation to ai-planner", () => {
    expect(mapWorkspaceAiMemberToAgentId("ideation")).toBe("ai-planner");
    expect(mapAiMemberRoleToAgentId("planner")).toBe("ai-planner");
    const agent = resolveAgentDefinitionForWorkspaceMember("ideation");
    expect(agent?.id).toBe("ai-planner");
  });

  it("AI member bridge maps prototype_build to ai-developer", () => {
    expect(WORKSPACE_AI_MEMBER_TO_AGENT_ID.prototype_build).toBe("ai-developer");
    expect(mapWorkspaceAiMemberToAgentId("prototype_build")).toBe("ai-developer");
    expect(
      mapRequirementIntentToPrimaryAgentId({
        suggestedActionId: "GENERATE_DOCUMENT",
        authoritativeStage: "FEATURE_DETAIL",
      }),
    ).toBe("ai-developer");
  });

  it("connector-required capabilities do not conflict with agent connectors", () => {
    for (const agent of listAgents()) {
      for (const capId of agent.defaultCapabilities) {
        expect(validateAgentCapabilityBinding(agent.id, capId)).toBe(true);
      }
    }
  });

  it("DEFAULT_CONNECTORS includes cursor and github", () => {
    const ids = DEFAULT_CONNECTORS.map((c) => c.id);
    expect(ids).toContain("cursor");
    expect(ids).toContain("github");
    expect(getConnectorById("cursor")?.enabled).toBe(true);
    expect(getConnectorById("github")?.enabled).toBe(true);
  });

  it("disabled connectors are not execution targets", () => {
    expect(isConnectorEnabledForExecution("codex")).toBe(false);
    expect(isConnectorEnabledForExecution("copilot")).toBe(false);
    expect(isConnectorEnabledForExecution("cursor")).toBe(true);
    const enabledOnly = getAllConnectors(true);
    expect(enabledOnly.every((c) => c.enabled)).toBe(true);
    expect(enabledOnly.some((c) => c.id === "codex")).toBe(false);
  });
});
