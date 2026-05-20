/**
 * Agent ↔ Capability binding queries (Harness / governance pre-check input).
 */

import type { AgentType } from "@/lib/agents/agentDefinitionTypes";
import type { CapabilityDefinition } from "@/lib/agents/capabilityDefinitionTypes";
import { getAgentById } from "@/lib/agents/agentRegistry";
import { getCapabilityById, listCapabilities } from "@/lib/agents/capabilityRegistry";

export function getCapabilitiesForAgent(agentId: string): readonly CapabilityDefinition[] {
  const agent = getAgentById(agentId);
  if (!agent) return [];
  return agent.defaultCapabilities
    .map((id) => getCapabilityById(id))
    .filter((c): c is CapabilityDefinition => Boolean(c));
}

export function getCapabilitiesByAgentType(agentType: AgentType): readonly CapabilityDefinition[] {
  return listCapabilities().filter(
    (c) => !c.allowedAgentTypes?.length || c.allowedAgentTypes.includes(agentType),
  );
}

export function validateAgentCapabilityBinding(agentId: string, capabilityId: string): boolean {
  const agent = getAgentById(agentId);
  const cap = getCapabilityById(capabilityId);
  if (!agent || !cap || !agent.enabled || !cap.enabled) return false;

  if (cap.allowedAgentTypes?.length && !cap.allowedAgentTypes.includes(agent.type)) {
    return false;
  }

  for (const conn of cap.requiredConnectors ?? []) {
    if (!agent.allowedConnectors.includes(conn)) return false;
  }

  return true;
}
