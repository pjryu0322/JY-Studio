/**
 * Multi-Agent Runtime Foundation — public API (Stage 1 + Stage 2 prep).
 * Prefer registry functions over importing default* arrays directly.
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

export type {
  AgentConnectorBoundary,
  ConnectorDescriptor,
  ConnectorType,
} from "@/lib/agents/connectorDescriptorTypes";

export type {
  AgentReplayExtension,
  AgentReplaySnapshotContract,
  AgentRuntimeEventContext,
  AgentRuntimeEventSource,
  AgentTimelineMetadata,
} from "@/lib/agents/agentRuntimeEventContract";

export {
  getAgentById,
  getAllAgents,
  getAgentsByType,
  listAgents,
  listAgentsByType,
} from "@/lib/agents/agentRegistry";

export {
  getAllCapabilities,
  getCapabilityById,
  hasCapability,
  listCapabilities,
} from "@/lib/agents/capabilityRegistry";

export {
  getCapabilitiesByAgentType,
  getCapabilitiesForAgent,
  validateAgentCapabilityBinding,
} from "@/lib/agents/agentCapabilityBinding";

export {
  assertDefaultAgentRegistryValid,
  validateAgentDefinition,
  validateDefaultAgentRegistry,
} from "@/lib/agents/agentRegistryValidation";

export {
  getDefaultAgentForStage,
  mapAiMemberRoleToAgentId,
  mapProjectMemberToAgentId,
  mapRequirementIntentToPrimaryAgentId,
  mapWorkspaceAiMemberToAgentId,
  ORCHESTRATION_ROLE_TO_AGENT_ID,
  resolveAgentDefinitionForOrchestrationRole,
  resolveAgentDefinitionForWorkspaceMember,
  resolveAgentIdFromRuntimeRole,
  WORKSPACE_AI_MEMBER_TO_AGENT_ID,
  type ProjectMemberAgentBridgeInput,
  type RequirementIntentBridgeInput,
} from "@/lib/agents/aiMemberAgentBridge";

export {
  agentReplayContractFromFoundation,
  agentTimelineMetadataFromReplay,
  buildAgentRuntimeEventContext,
} from "@/lib/agents/orchestrationRuntimeBridge";

export {
  buildAgentConnectorBoundary,
  getAllConnectors,
  getConnectorById,
  isConnectorEnabledForExecution,
} from "@/lib/agents/connectorRegistry";

export type {
  BuildRequirementsAgentMetadataInput,
  RequirementsAgentRuntimeMetadata,
  ResolveDispatchAgentInput,
  ResolveDispatchAgentResult,
  ResolveDispatchCapabilityInput,
  ResolveDispatchCapabilityResult,
} from "@/lib/agents/requirementsDispatchAgentMetadata";

export {
  buildRequirementsAgentMetadata,
  formatAgentMetadataForTimeline,
  resolveDispatchAgent,
  resolveDispatchCapability,
} from "@/lib/agents/requirementsDispatchAgentMetadata";

/** @internal Tests and registry bootstrap only. */
export { DEFAULT_AGENTS } from "@/lib/agents/defaultAgents";
export { DEFAULT_CAPABILITIES } from "@/lib/agents/defaultCapabilities";
export { DEFAULT_CONNECTORS } from "@/lib/agents/defaultConnectors";
