/**
 * Multi-Agent Runtime Foundation — Stage 1 public surface.
 */

export type {
  AgentDefinition,
  AgentInputContract,
  AgentOutputContract,
  AgentRuntimeMode,
  AgentType,
  ConnectorId,
} from "@/lib/agents/agentDefinitionTypes";

export type { CapabilityCategory, CapabilityDefinition } from "@/lib/agents/capabilityDefinitionTypes";

export { DEFAULT_AGENTS } from "@/lib/agents/defaultAgents";
export { DEFAULT_CAPABILITIES } from "@/lib/agents/defaultCapabilities";

export {
  getAgentById,
  listAgents,
  listAgentsByType,
} from "@/lib/agents/agentRegistry";

export {
  getCapabilityById,
  hasCapability,
  listCapabilities,
} from "@/lib/agents/capabilityRegistry";

export {
  assertDefaultAgentRegistryValid,
  validateAgentDefinition,
  validateDefaultAgentRegistry,
} from "@/lib/agents/agentRegistryValidation";

export {
  ORCHESTRATION_ROLE_TO_AGENT_ID,
  WORKSPACE_AI_MEMBER_TO_AGENT_ID,
  resolveAgentDefinitionForOrchestrationRole,
  resolveAgentDefinitionForWorkspaceMember,
} from "@/lib/agents/aiMemberAgentBridge";

export {
  agentTimelineMetadataFromReplay,
  type AgentReplayExtension,
  type AgentTimelineMetadata,
} from "@/lib/agents/orchestrationRuntimeBridge";
