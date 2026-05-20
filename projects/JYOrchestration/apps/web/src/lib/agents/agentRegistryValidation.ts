import type { AgentDefinition } from "@/lib/agents/agentDefinitionTypes";
import { getCapabilityById } from "@/lib/agents/capabilityRegistry";
import { DEFAULT_AGENTS } from "@/lib/agents/defaultAgents";

export type AgentRegistryValidationIssue = Readonly<{
  readonly agentId: string;
  readonly code: "missing_capability" | "agent_type_not_allowed" | "missing_connector";
  readonly detail: string;
}>;

export function validateAgentDefinition(agent: AgentDefinition): readonly AgentRegistryValidationIssue[] {
  const issues: AgentRegistryValidationIssue[] = [];

  for (const capId of agent.defaultCapabilities) {
    const cap = getCapabilityById(capId);
    if (!cap) {
      issues.push({
        agentId: agent.id,
        code: "missing_capability",
        detail: `capability not found: ${capId}`,
      });
      continue;
    }
    if (cap.allowedAgentTypes?.length && !cap.allowedAgentTypes.includes(agent.type)) {
      issues.push({
        agentId: agent.id,
        code: "agent_type_not_allowed",
        detail: `${capId} does not allow type ${agent.type}`,
      });
    }
    for (const conn of cap.requiredConnectors ?? []) {
      if (!agent.allowedConnectors.includes(conn)) {
        issues.push({
          agentId: agent.id,
          code: "missing_connector",
          detail: `${capId} requires connector ${conn}`,
        });
      }
    }
  }

  return issues;
}

export function validateDefaultAgentRegistry(): readonly AgentRegistryValidationIssue[] {
  return DEFAULT_AGENTS.flatMap((a) => validateAgentDefinition(a));
}

export function assertDefaultAgentRegistryValid(): void {
  const issues = validateDefaultAgentRegistry();
  if (issues.length) {
    throw new Error(
      `Agent registry validation failed: ${issues.map((i) => `${i.agentId}:${i.code}:${i.detail}`).join("; ")}`,
    );
  }
}
