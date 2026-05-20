/**
 * Connector descriptor registry — execution eligibility only (no Gateway calls).
 */

import type { AgentConnectorBoundary, ConnectorDescriptor } from "@/lib/agents/connectorDescriptorTypes";
import { DEFAULT_CONNECTORS } from "@/lib/agents/defaultConnectors";
import { getAgentById } from "@/lib/agents/agentRegistry";

const byId = new Map<string, ConnectorDescriptor>(DEFAULT_CONNECTORS.map((c) => [c.id, c]));

export function getAllConnectors(enabledOnly = false): readonly ConnectorDescriptor[] {
  const all = [...byId.values()];
  return enabledOnly ? all.filter((c) => c.enabled) : all;
}

export function getConnectorById(id: string): ConnectorDescriptor | undefined {
  return byId.get(id);
}

/** Disabled connectors (codex/copilot) are not default execution targets. */
export function isConnectorEnabledForExecution(connectorId: string): boolean {
  const c = getConnectorById(connectorId);
  return Boolean(c?.enabled);
}

export function buildAgentConnectorBoundary(agentId: string): AgentConnectorBoundary | undefined {
  const agent = getAgentById(agentId);
  if (!agent) return undefined;
  const allowed = agent.allowedConnectors.filter((id) => isConnectorEnabledForExecution(id));
  const denied = agent.allowedConnectors.filter((id) => !isConnectorEnabledForExecution(id));
  return {
    agentId,
    allowedConnectorIds: allowed,
    ...(denied.length ? { deniedConnectorIds: denied } : {}),
    notes: "Derived from AgentDefinition.allowedConnectors × connector.enabled",
  };
}
