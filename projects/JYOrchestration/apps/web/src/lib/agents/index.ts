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
  ConnectorInvocationMode,
  ConnectorInvocationRequest,
  ConnectorInvocationResult,
  ConnectorInvocationStatus,
} from "@/lib/agents/connectorGatewayFacadeTypes";

export type {
  BuildConnectorInvocationInput,
  BuildConnectorPlanFromAgentMetadataInput as BuildConnectorFacadePlanFromAgentMetadataInput,
  PlanNamedConnectorInvocationInput,
} from "@/lib/agents/connectorGatewayFacade";

export {
  buildConnectorInvocationRequest,
  buildConnectorPlanFromAgentMetadata,
  evaluateConnectorInvocation,
  planConnectorInvocation,
  planCursorConnectorInvocation,
  planGithubConnectorInvocation,
} from "@/lib/agents/connectorGatewayFacade";

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

export type {
  HarnessDryRunRequest,
  HarnessDryRunResult,
  HarnessDryRunSource,
  HarnessDryRunStatus,
  HarnessGovernanceDryRunSummary,
  HarnessGovernancePrecheck,
  HarnessGovernancePrecheckStatus,
} from "@/lib/agents/agentHarnessDryRunTypes";

export {
  buildGovernancePrecheckForCapability,
  buildHarnessDryRunRequest,
  planAgentHarnessDryRun,
  planRequirementsHarnessDryRun,
  summarizeGovernanceDryRun,
} from "@/lib/agents/agentHarnessDryRun";

export type {
  GovernancePolicyDescriptor,
  GovernancePrecheckDryRunResult,
  GovernancePrecheckFinding,
  GovernancePrecheckSeverity,
  GovernancePrecheckStatus,
} from "@/lib/agents/governancePrecheckDryRunTypes";

export {
  evaluateGovernancePrecheckDryRun,
} from "@/lib/agents/governancePrecheckDryRun";

export {
  getGovernancePoliciesForCheck,
  getGovernancePoliciesForChecks,
  getGovernancePolicyById,
  listGovernancePolicies,
} from "@/lib/agents/governancePolicyRegistry";

export type {
  AgentConnectorPassThroughSummary,
  AgentConnectorPlanSummary,
  AgentGovernanceDryRunPersistenceSummary,
  AgentRuntimePersistenceCandidate,
  AgentRuntimePersistenceCandidateKind,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";

export type {
  ConnectorPassThroughBoundary,
  ConnectorPassThroughBoundaryKind,
  ConnectorPassThroughRecordCandidate,
} from "@/lib/agents/connectorPassThroughBoundaryTypes";

export { CONNECTOR_PASS_THROUGH_RECORD_SCHEMA_VERSION } from "@/lib/agents/connectorPassThroughBoundaryTypes";

export {
  AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
  AGENT_RUNTIME_REGISTRY_VERSION,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";

export { buildAgentRuntimePersistenceCandidateFromHarness } from "@/lib/agents/buildAgentRuntimePersistenceCandidate";

export {
  sanitizeAgentRuntimePersistenceCandidate,
  validateAgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

export {
  buildReplaySnapshotCandidateFromHarness,
  buildTimelineMetadataCandidateFromHarness,
} from "@/lib/agents/agentRuntimeTimelineReplayCandidate";

export { buildConnectorPassThroughRecordCandidate } from "@/lib/agents/buildConnectorPassThroughRecordCandidate";

export {
  attachPassThroughSummaryToPersistenceCandidate,
  buildConnectorPassThroughRecordFromHarness,
} from "@/lib/agents/connectorPassThroughPersistenceCandidate";

export {
  getConnectorPassThroughBoundariesByConnector,
  getConnectorPassThroughBoundariesByKind,
  getConnectorPassThroughBoundaryById,
  listConnectorPassThroughBoundaries,
} from "@/lib/agents/connectorPassThroughBoundaryRegistry";

export {
  isForbiddenPersistenceKey,
  MAX_CANDIDATE_JSON_LENGTH,
} from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

export type {
  AgentRuntimeDiagnosticViewMode,
  AgentRuntimeDiagnosticViewModel,
  GovernanceDiagnosticSection,
  HarnessDiagnosticSection,
  PassThroughDiagnosticRecordRow,
  PassThroughDiagnosticSection,
  PersistenceCandidateDiagnosticSection,
} from "@/lib/agents/agentRuntimeDiagnosticViewTypes";

export {
  AGENT_RUNTIME_DIAGNOSTIC_DISCLAIMER,
  AGENT_RUNTIME_DIAGNOSTIC_TITLE,
} from "@/lib/agents/agentRuntimeDiagnosticViewTypes";

export { buildAgentRuntimeDiagnosticViewModel } from "@/lib/agents/buildAgentRuntimeDiagnosticViewModel";

export { buildAgentRuntimeDiagnosticSampleViewModel } from "@/lib/agents/buildAgentRuntimeDiagnosticSample";

export type {
  AgentRuntimePersistenceDecision,
  AgentRuntimePersistenceDecisionFinding,
  AgentRuntimePersistenceDecisionReport,
  AgentRuntimePersistenceTarget,
} from "@/lib/agents/agentRuntimePersistenceDecisionTypes";

export {
  evaluateAgentRuntimePersistenceDecision,
  mapPersistenceDecisionToDiagnosticSection,
} from "@/lib/agents/evaluateAgentRuntimePersistenceDecision";

export type {
  ConnectorRoutingDecisionDiagnosticSection,
  PersistenceDecisionDiagnosticSection,
} from "@/lib/agents/agentRuntimeDiagnosticViewTypes";

export type {
  ConnectorGatewayRoutingDecision,
  ConnectorGatewayRoutingDecisionReport,
  ConnectorGatewayRoutingFinding,
  ConnectorGatewayRoutingTarget,
} from "@/lib/agents/connectorGatewayRoutingDecisionTypes";

export {
  evaluateConnectorGatewayRoutingDecision,
  mapConnectorRoutingDecisionToDiagnosticSection,
} from "@/lib/agents/evaluateConnectorGatewayRoutingDecision";

export type {
  AgentRuntimeExecutionTransitionDecision,
  AgentRuntimeExecutionTransitionFinding,
  AgentRuntimeExecutionTransitionReport,
  AgentRuntimeExecutionTransitionTarget,
} from "@/lib/agents/agentRuntimeExecutionTransitionTypes";

export { evaluateAgentRuntimeExecutionTransition } from "@/lib/agents/evaluateAgentRuntimeExecutionTransition";

export type {
  TimelineReplayPersistDesignDecision,
  TimelineReplayPersistDesignFinding,
  TimelineReplayPersistDesignReport,
  TimelineReplayPersistFieldDecision,
  TimelineReplayPersistFieldSensitivity,
  TimelineReplayPersistTarget,
} from "@/lib/agents/timelineReplayPersistDesignTypes";

export {
  evaluateTimelineReplayPersistDesign,
  inferTargetFromCandidateKind,
  uniqueFieldDecisions,
} from "@/lib/agents/evaluateTimelineReplayPersistDesign";

export type {
  GovernanceEnforcementDesignDecision,
  GovernanceEnforcementDesignFinding,
  GovernanceEnforcementDesignReport,
  GovernanceEnforcementMode,
  GovernanceEnforcementPolicyDecision,
} from "@/lib/agents/governanceEnforcementDesignTypes";

export { evaluateGovernanceEnforcementDesign } from "@/lib/agents/evaluateGovernanceEnforcementDesign";

export type { ConnectorPassThroughRecordSource } from "@/lib/agents/connectorPassThroughBoundaryTypes";

/** @internal Tests and registry bootstrap only. */
export { DEFAULT_AGENTS } from "@/lib/agents/defaultAgents";
export { DEFAULT_CAPABILITIES } from "@/lib/agents/defaultCapabilities";
export { DEFAULT_CONNECTORS } from "@/lib/agents/defaultConnectors";
export { DEFAULT_GOVERNANCE_POLICIES } from "@/lib/agents/defaultGovernancePolicies";
export { DEFAULT_CONNECTOR_PASS_THROUGH_BOUNDARIES } from "@/lib/agents/defaultConnectorPassThroughBoundaries";
