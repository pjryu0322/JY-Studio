import type { AgentDefinition, AgentType } from "@/lib/agents/agentDefinitionTypes";
import { DEFAULT_AGENTS } from "@/lib/agents/defaultAgents";

const byId = new Map<string, AgentDefinition>(DEFAULT_AGENTS.map((a) => [a.id, a]));

export function listAgents(enabledOnly = true): readonly AgentDefinition[] {
  const all = [...byId.values()];
  return enabledOnly ? all.filter((a) => a.enabled) : all;
}

export function getAgentById(id: string): AgentDefinition | undefined {
  return byId.get(id);
}

export function listAgentsByType(type: AgentType): readonly AgentDefinition[] {
  return listAgents().filter((a) => a.type === type);
}

/** Public API alias — prefer over direct `DEFAULT_AGENTS` import. */
export const getAllAgents = listAgents;

export const getAgentsByType = listAgentsByType;
