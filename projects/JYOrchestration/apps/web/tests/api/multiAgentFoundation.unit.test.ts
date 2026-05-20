import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENTS,
  DEFAULT_CAPABILITIES,
  assertDefaultAgentRegistryValid,
  getAgentById,
  getCapabilityById,
  listAgents,
  listCapabilities,
  validateDefaultAgentRegistry,
  WORKSPACE_AI_MEMBER_TO_AGENT_ID,
  resolveAgentDefinitionForWorkspaceMember,
} from "@/lib/agents";

describe("multi-agent foundation stage 1", () => {
  it("defaultAgents is non-empty", () => {
    expect(listAgents().length).toBeGreaterThan(0);
    expect(DEFAULT_AGENTS.length).toBeGreaterThanOrEqual(5);
  });

  it("defaultCapabilities is non-empty", () => {
    expect(listCapabilities().length).toBeGreaterThan(0);
    expect(DEFAULT_CAPABILITIES.length).toBeGreaterThanOrEqual(8);
  });

  it("every agent defaultCapability exists in registry", () => {
    for (const agent of listAgents()) {
      for (const capId of agent.defaultCapabilities) {
        expect(getCapabilityById(capId), `${agent.id}:${capId}`).toBeDefined();
      }
    }
  });

  it("capability allowedAgentTypes includes assigned agents", () => {
    for (const agent of listAgents()) {
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

  it("workspace AI member bridge resolves known members", () => {
    const agent = resolveAgentDefinitionForWorkspaceMember("ideation");
    expect(agent?.id).toBe("ai-planner");
    expect(WORKSPACE_AI_MEMBER_TO_AGENT_ID.prototype_build).toBe("ai-developer");
  });

  it("developer agent includes cursor connector for cursor capability", () => {
    const dev = getAgentById("ai-developer");
    expect(dev?.allowedConnectors).toContain("cursor");
    expect(dev?.defaultCapabilities).toContain("cursor.implementation.plan");
  });
});
