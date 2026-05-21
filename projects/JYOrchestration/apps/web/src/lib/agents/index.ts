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

export type {
  ConnectorGatewayRoutingExperimentDecision,
  ConnectorGatewayRoutingExperimentFinding,
  ConnectorGatewayRoutingExperimentReport,
  ConnectorGatewayRoutingExperimentScope,
} from "@/lib/agents/connectorGatewayRoutingExperimentTypes";

export { evaluateConnectorGatewayRoutingExperiment } from "@/lib/agents/evaluateConnectorGatewayRoutingExperiment";

export type {
  AgentExecutionRecordDesignDecision,
  AgentExecutionRecordDesignFinding,
  AgentExecutionRecordDesignReport,
  AgentExecutionRecordFieldDecision,
  AgentExecutionRecordFieldSensitivity,
  AgentExecutionRecordTarget,
} from "@/lib/agents/agentExecutionRecordDesignTypes";

export {
  evaluateAgentExecutionRecordDesign,
  normalizeExecutionRecordTarget,
} from "@/lib/agents/evaluateAgentExecutionRecordDesign";

export { uniqueFieldDecisions as uniqueExecutionRecordFieldDecisions } from "@/lib/agents/agentFieldDecisionUtils";

export type {
  OperatorApprovalAuditDesignDecision,
  OperatorApprovalAuditDesignFinding,
  OperatorApprovalAuditDesignReport,
  OperatorApprovalAuditFieldDecision,
  OperatorApprovalAuditFieldSensitivity,
  OperatorApprovalAuditTarget,
} from "@/lib/agents/operatorApprovalAuditDesignTypes";

export {
  evaluateOperatorApprovalAuditDesign,
  normalizeOperatorApprovalAuditTarget,
} from "@/lib/agents/evaluateOperatorApprovalAuditDesign";

export type {
  ConnectorGatewayExperimentBranchPlanDecision,
  ConnectorGatewayExperimentBranchPlanFinding,
  ConnectorGatewayExperimentBranchPlanReport,
  ConnectorGatewayExperimentBranchPlanScope,
} from "@/lib/agents/connectorGatewayExperimentBranchPlanTypes";

export { evaluateConnectorGatewayExperimentBranchPlan } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchPlan";

export type {
  AgentExecutionRecordSchemaDecision,
  AgentExecutionRecordSchemaDecisionReport,
  AgentExecutionRecordSchemaFieldProposal,
  AgentExecutionRecordSchemaFinding,
  AgentExecutionRecordSchemaTarget,
} from "@/lib/agents/agentExecutionRecordSchemaDecisionTypes";

export {
  evaluateAgentExecutionRecordSchemaDecision,
  normalizeAgentExecutionRecordSchemaTarget,
} from "@/lib/agents/evaluateAgentExecutionRecordSchemaDecision";

export type {
  OperatorApprovalAuditSchemaDecision,
  OperatorApprovalAuditSchemaDecisionReport,
  OperatorApprovalAuditSchemaFieldProposal,
  OperatorApprovalAuditSchemaFinding,
  OperatorApprovalAuditSchemaTarget,
} from "@/lib/agents/operatorApprovalAuditSchemaDecisionTypes";

export {
  evaluateOperatorApprovalAuditSchemaDecision,
  normalizeOperatorApprovalAuditSchemaTarget,
} from "@/lib/agents/evaluateOperatorApprovalAuditSchemaDecision";

export type {
  ConnectorGatewayExperimentBranchApprovalChecklistItem,
  ConnectorGatewayExperimentBranchApprovalDecision,
  ConnectorGatewayExperimentBranchApprovalFinding,
  ConnectorGatewayExperimentBranchApprovalReport,
  ConnectorGatewayExperimentBranchApprovalScope,
} from "@/lib/agents/connectorGatewayExperimentBranchApprovalTypes";

export { evaluateConnectorGatewayExperimentBranchApproval } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchApproval";

export type {
  AgentExecutionRecordWritePathChecklistItem,
  AgentExecutionRecordWritePathDecision,
  AgentExecutionRecordWritePathDesignReport,
  AgentExecutionRecordWritePathFinding,
  AgentExecutionRecordWritePathTarget,
} from "@/lib/agents/agentExecutionRecordWritePathDesignTypes";

export {
  evaluateAgentExecutionRecordWritePathDesign,
  normalizeAgentExecutionRecordWritePathTarget,
} from "@/lib/agents/evaluateAgentExecutionRecordWritePathDesign";

export type {
  OperatorApprovalAuditWritePathChecklistItem,
  OperatorApprovalAuditWritePathDecision,
  OperatorApprovalAuditWritePathDesignReport,
  OperatorApprovalAuditWritePathFinding,
  OperatorApprovalAuditWritePathTarget,
} from "@/lib/agents/operatorApprovalAuditWritePathDesignTypes";

export {
  evaluateOperatorApprovalAuditWritePathDesign,
  normalizeOperatorApprovalAuditWritePathTarget,
} from "@/lib/agents/evaluateOperatorApprovalAuditWritePathDesign";

export type {
  ConnectorGatewayExperimentBranchCreationChecklistItem,
  ConnectorGatewayExperimentBranchCreationCommandCandidate,
  ConnectorGatewayExperimentBranchCreationReadinessDecision,
  ConnectorGatewayExperimentBranchCreationReadinessFinding,
  ConnectorGatewayExperimentBranchCreationReadinessReport,
} from "@/lib/agents/connectorGatewayExperimentBranchCreationReadinessTypes";

export { evaluateConnectorGatewayExperimentBranchCreationReadiness } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchCreationReadiness";
export {
  isSafeBranchName,
  isSafeFeatureFlagName,
} from "@/lib/agents/evaluateConnectorGatewayExperimentBranchCreationReadiness";

export type {
  AgentExecutionRecordSchemaPrChecklistItem,
  AgentExecutionRecordSchemaPrFinding,
  AgentExecutionRecordSchemaPrModelCandidate,
  AgentExecutionRecordSchemaPrReadinessDecision,
  AgentExecutionRecordSchemaPrReadinessReport,
} from "@/lib/agents/agentExecutionRecordSchemaPrReadinessTypes";

export {
  evaluateAgentExecutionRecordSchemaPrReadiness,
  modelDraftContainsForbiddenField as agentExecutionRecordModelDraftContainsForbiddenField,
} from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrReadiness";

export type {
  OperatorApprovalAuditSchemaPrChecklistItem,
  OperatorApprovalAuditSchemaPrFinding,
  OperatorApprovalAuditSchemaPrModelCandidate,
  OperatorApprovalAuditSchemaPrReadinessDecision,
  OperatorApprovalAuditSchemaPrReadinessReport,
} from "@/lib/agents/operatorApprovalAuditSchemaPrReadinessTypes";

export {
  evaluateOperatorApprovalAuditSchemaPrReadiness,
  modelDraftContainsForbiddenField as operatorApprovalAuditModelDraftContainsForbiddenField,
} from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrReadiness";

export type {
  ConnectorGatewayExperimentBranchExecutionCommand,
  ConnectorGatewayExperimentBranchExecutionPackageDecision,
  ConnectorGatewayExperimentBranchExecutionPackageFinding,
  ConnectorGatewayExperimentBranchExecutionPreflightChecklistItem,
  ConnectorGatewayExperimentBranchExecutionPackageReport,
} from "@/lib/agents/connectorGatewayExperimentBranchExecutionPackageTypes";

export { evaluateConnectorGatewayExperimentBranchExecutionPackage } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchExecutionPackage";

export type {
  AgentExecutionRecordSchemaPrApprovalChecklistItem,
  AgentExecutionRecordSchemaPrApprovalDecision,
  AgentExecutionRecordSchemaPrApprovalFinding,
  AgentExecutionRecordSchemaPrApprovalPackageReport,
} from "@/lib/agents/agentExecutionRecordSchemaPrApprovalPackageTypes";

export { evaluateAgentExecutionRecordSchemaPrApprovalPackage } from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrApprovalPackage";

export type {
  OperatorApprovalAuditSchemaPrApprovalChecklistItem,
  OperatorApprovalAuditSchemaPrApprovalDecision,
  OperatorApprovalAuditSchemaPrApprovalFinding,
  OperatorApprovalAuditSchemaPrApprovalPackageReport,
} from "@/lib/agents/operatorApprovalAuditSchemaPrApprovalPackageTypes";

export { evaluateOperatorApprovalAuditSchemaPrApprovalPackage } from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrApprovalPackage";

export type {
  ConnectorGatewayExperimentBranchManualVerificationChecklistItem,
  ConnectorGatewayExperimentBranchManualVerificationDecision,
  ConnectorGatewayExperimentBranchManualVerificationFinding,
  ConnectorGatewayExperimentBranchManualVerificationReport,
  ConnectorGatewayExperimentBranchRegressionResult,
} from "@/lib/agents/connectorGatewayExperimentBranchManualVerificationTypes";

export { evaluateConnectorGatewayExperimentBranchManualVerification } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchManualVerification";

export type {
  AgentExecutionRecordWritePathWireApprovalChecklistItem,
  AgentExecutionRecordWritePathWireApprovalDecision,
  AgentExecutionRecordWritePathWireApprovalFinding,
  AgentExecutionRecordWritePathWireApprovalGateReport,
} from "@/lib/agents/agentExecutionRecordWritePathWireApprovalGateTypes";

export { evaluateAgentExecutionRecordWritePathWireApprovalGate } from "@/lib/agents/evaluateAgentExecutionRecordWritePathWireApprovalGate";

export type {
  OperatorApprovalAuditWritePathWireApprovalChecklistItem,
  OperatorApprovalAuditWritePathWireApprovalDecision,
  OperatorApprovalAuditWritePathWireApprovalFinding,
  OperatorApprovalAuditWritePathWireApprovalGateReport,
} from "@/lib/agents/operatorApprovalAuditWritePathWireApprovalGateTypes";

export { evaluateOperatorApprovalAuditWritePathWireApprovalGate } from "@/lib/agents/evaluateOperatorApprovalAuditWritePathWireApprovalGate";

export type {
  ConnectorGatewayRoutingShadowBoundarySource,
  ConnectorGatewayRoutingShadowChecklistItem,
  ConnectorGatewayRoutingShadowConnectorSource,
  ConnectorGatewayRoutingShadowDecision,
  ConnectorGatewayRoutingShadowFinding,
  ConnectorGatewayRoutingShadowReport,
  ConnectorGatewayRoutingShadowRequest,
  ConnectorGatewayRoutingShadowRouteMode,
} from "@/lib/agents/connectorGatewayRoutingShadowTypes";

export { evaluateConnectorGatewayRoutingShadow } from "@/lib/agents/evaluateConnectorGatewayRoutingShadow";

export type {
  WriteAdapterDesignIntegrationChecklistItem,
  WriteAdapterDesignIntegrationDecision,
  WriteAdapterDesignIntegrationFinding,
  WriteAdapterDesignIntegrationReport,
} from "@/lib/agents/writeAdapterDesignIntegrationTypes";

export { evaluateWriteAdapterDesignIntegration } from "@/lib/agents/evaluateWriteAdapterDesignIntegration";

export type {
  SchemaMigrationPrReadinessIntegrationChecklistItem,
  SchemaMigrationPrReadinessIntegrationDecision,
  SchemaMigrationPrReadinessIntegrationFinding,
  SchemaMigrationPrReadinessIntegrationReport,
} from "@/lib/agents/schemaMigrationPrReadinessIntegrationTypes";

export { evaluateSchemaMigrationPrReadinessIntegration } from "@/lib/agents/evaluateSchemaMigrationPrReadinessIntegration";

export type {
  WritePathWireCandidateVerificationChecklistItem,
  WritePathWireCandidateVerificationDecision,
  WritePathWireCandidateVerificationFinding,
  WritePathWireCandidateVerificationReport,
} from "@/lib/agents/writePathWireCandidateVerificationTypes";

export { evaluateWritePathWireCandidateVerification } from "@/lib/agents/evaluateWritePathWireCandidateVerification";

export type {
  RuntimeChangeFinalApprovalPackageChecklistItem,
  RuntimeChangeFinalApprovalPackageDecision,
  RuntimeChangeFinalApprovalPackageFinding,
  RuntimeChangeFinalApprovalPackageReport,
} from "@/lib/agents/runtimeChangeFinalApprovalPackageTypes";

export { evaluateRuntimeChangeFinalApprovalPackage } from "@/lib/agents/evaluateRuntimeChangeFinalApprovalPackage";

export type {
  Stage2IntegratedClosureVerdictChecklistItem,
  Stage2IntegratedClosureVerdictDecision,
  Stage2IntegratedClosureVerdictFinding,
  Stage2IntegratedClosureVerdictReport,
  Stage2NextPhaseRecommendation,
  Stage2Stage3Candidate,
} from "@/lib/agents/stage2IntegratedClosureVerdictTypes";

export { evaluateStage2IntegratedClosureVerdict } from "@/lib/agents/evaluateStage2IntegratedClosureVerdict";

export type {
  RuntimeExecutionHandoffCandidateChecklistItem,
  RuntimeExecutionHandoffCandidateDecision,
  RuntimeExecutionHandoffCandidateFinding,
  RuntimeExecutionHandoffCandidateReport,
} from "@/lib/agents/runtimeExecutionHandoffCandidateTypes";

export { evaluateRuntimeExecutionHandoffCandidate } from "@/lib/agents/evaluateRuntimeExecutionHandoffCandidate";

export type {
  RuntimeExecutionPlanBuilderChecklistItem,
  RuntimeExecutionPlanBuilderDecision,
  RuntimeExecutionPlanBuilderFinding,
  RuntimeExecutionPlanBuilderReport,
  RuntimeExecutionPlanStepCandidate,
  RuntimeExecutionPlanStepKind,
} from "@/lib/agents/runtimeExecutionPlanBuilderTypes";

export { evaluateRuntimeExecutionPlanBuilder } from "@/lib/agents/evaluateRuntimeExecutionPlanBuilder";

export type {
  RuntimeExecutionApprovalReadiness,
  RuntimeExecutionDryRunCandidate,
  RuntimeExecutionDryRunCandidateStatus,
  RuntimeExecutionPlanPackageChecklistItem,
  RuntimeExecutionPlanPackageDecision,
  RuntimeExecutionPlanPackageFinding,
  RuntimeExecutionPlanPackageReport,
} from "@/lib/agents/runtimeExecutionPlanPackageTypes";

export { evaluateRuntimeExecutionPlanPackage } from "@/lib/agents/evaluateRuntimeExecutionPlanPackage";

export type {
  RuntimeExecutionApprovalGateChecklistItem,
  RuntimeExecutionApprovalGateDecision,
  RuntimeExecutionApprovalGateFinding,
  RuntimeExecutionApprovalGateReport,
} from "@/lib/agents/runtimeExecutionApprovalGateTypes";

export {
  buildRuntimeExecutionApprovalGateFingerprint,
  evaluateRuntimeExecutionApprovalGate,
} from "@/lib/agents/evaluateRuntimeExecutionApprovalGate";

export type {
  ControlledRuntimeWireCandidateChecklistItem,
  ControlledRuntimeWireCandidateDecision,
  ControlledRuntimeWireCandidateFinding,
  ControlledRuntimeWireCandidateItem,
  ControlledRuntimeWireCandidateKind,
  ControlledRuntimeWireCandidateReport,
} from "@/lib/agents/controlledRuntimeWireCandidateTypes";

export { evaluateControlledRuntimeWireCandidate } from "@/lib/agents/evaluateControlledRuntimeWireCandidate";

export type {
  RuntimeWireExperimentBranchManualCommand,
  RuntimeWireExperimentBranchPlanChecklistItem,
  RuntimeWireExperimentBranchPlanDecision,
  RuntimeWireExperimentBranchPlanFinding,
  RuntimeWireExperimentBranchPlanReport,
  RuntimeWireExperimentBranchPlanSourceNoRunFlags,
} from "@/lib/agents/runtimeWireExperimentBranchPlanTypes";

export {
  buildRuntimeWireExperimentBranchManualCommands,
  buildRuntimeWireExperimentBranchName,
  buildRuntimeWireExperimentBranchPlanFingerprint,
  buildRuntimeWireFeatureFlagName,
  evaluateRuntimeWireExperimentBranchPlan,
  resolveRuntimeWireExperimentBranchPlanDecision,
  runtimeWireExperimentBranchPlanSourceNoRunFlags,
  runtimeWireManualCommandCautionsValid,
} from "@/lib/agents/evaluateRuntimeWireExperimentBranchPlan";

export type {
  RuntimeWireManualBranchVerificationChecklistItem,
  RuntimeWireManualBranchVerificationDecision,
  RuntimeWireManualBranchVerificationFinding,
  RuntimeWireManualBranchVerificationRegressionResult,
  RuntimeWireManualBranchVerificationReport,
} from "@/lib/agents/runtimeWireManualBranchVerificationTypes";

export {
  evaluateRuntimeWireManualBranchVerification,
  sanitizeRuntimeWireRegressionResults,
} from "@/lib/agents/evaluateRuntimeWireManualBranchVerification";

export type {
  ConnectorGatewayShadowRouteCandidate,
  ConnectorGatewayShadowRoutingMode,
  ConnectorGatewayShadowRoutingPlanChecklistItem,
  ConnectorGatewayShadowRoutingPlanDecision,
  ConnectorGatewayShadowRoutingPlanFinding,
  ConnectorGatewayShadowRoutingPlanReport,
} from "@/lib/agents/connectorGatewayShadowRoutingPlanTypes";

export {
  evaluateConnectorGatewayShadowRoutingPlan,
  resolveConnectorGatewayShadowRoutingPlanDecision,
} from "@/lib/agents/evaluateConnectorGatewayShadowRoutingPlan";

export type { ConnectorGatewayShadowRoutingPlanDecisionInput } from "@/lib/agents/evaluateConnectorGatewayShadowRoutingPlan";

export type {
  ControlledExecutionPathCandidate,
  ControlledExecutionPathCandidateChecklistItem,
  ControlledExecutionPathCandidateDecision,
  ControlledExecutionPathCandidateFinding,
  ControlledExecutionPathCandidateMode,
  ControlledExecutionPathCandidateReport,
} from "@/lib/agents/controlledExecutionPathCandidateTypes";

export {
  evaluateControlledExecutionPathCandidate,
  resolveControlledExecutionPathCandidateDecision,
} from "@/lib/agents/evaluateControlledExecutionPathCandidate";

export type { ControlledExecutionPathCandidateDecisionInput } from "@/lib/agents/evaluateControlledExecutionPathCandidate";

export type {
  RuntimeWireExperimentReviewChecklistItem,
  RuntimeWireExperimentReviewFinding,
  RuntimeWireExperimentReviewPackageDecision,
  RuntimeWireExperimentReviewPackageReport,
} from "@/lib/agents/runtimeWireExperimentReviewPackageTypes";

export {
  buildRuntimeWireExperimentReviewFingerprint,
  evaluateRuntimeWireExperimentReviewPackage,
  resolveRuntimeWireExperimentReviewPackageDecision,
} from "@/lib/agents/evaluateRuntimeWireExperimentReviewPackage";

export type { RuntimeWireExperimentReviewPackageDecisionInput } from "@/lib/agents/evaluateRuntimeWireExperimentReviewPackage";

export type {
  Stage4IntegratedClosureChecklistItem,
  Stage4IntegratedClosureFinding,
  Stage4IntegratedClosureVerdictDecision,
  Stage4IntegratedClosureVerdictReport,
} from "@/lib/agents/stage4IntegratedClosureVerdictTypes";

export {
  buildStage4IntegratedClosureFingerprint,
  evaluateStage4IntegratedClosureVerdict,
  resolveStage4IntegratedClosureVerdictDecision,
} from "@/lib/agents/evaluateStage4IntegratedClosureVerdict";

export type { Stage4IntegratedClosureVerdictDecisionInput } from "@/lib/agents/evaluateStage4IntegratedClosureVerdict";

export type {
  RoleKnowledgeBindingStage,
  RoleKnowledgeBindingDecision,
  RoleKnowledgeBindingScope,
  RoleKnowledgePackKind,
  RoleKnowledgePackBinding,
  RoleKnowledgeBindingReadinessInput,
  RoleKnowledgeBindingReadinessReport,
  RoleKnowledgeBindingFinding,
  RoleKnowledgeBindingChecklistItem,
} from "@/lib/agents/roleKnowledgeBindingTypes";

export {
  DEFAULT_ROLE_KNOWLEDGE_BINDINGS,
  listDefaultRoleKnowledgeBindings,
  listDefaultRoleKnowledgeAgentTypes,
  getDefaultRoleKnowledgeBindingsForAgent,
} from "@/lib/agents/defaultRoleKnowledgeBindings";

export {
  buildRoleKnowledgeBindingClosureFingerprint,
  buildStage5AClosureConfirmedInput,
  evaluateRoleKnowledgeBindingClosure,
  REQUIRED_STAGE5_A_CLOSURE_CONFIRMATIONS,
  resolveRoleKnowledgeBindingClosureDecision,
} from "@/lib/agents/evaluateRoleKnowledgeBindingClosure";

export type {
  RoleKnowledgeBindingClosureAgentSummary,
  RoleKnowledgeBindingClosureChecklistItem,
  RoleKnowledgeBindingClosureDecision,
  RoleKnowledgeBindingClosureFinding,
  RoleKnowledgeBindingClosureInput,
  RoleKnowledgeBindingClosureReport,
} from "@/lib/agents/roleKnowledgeBindingClosureTypes";

export {
  buildDefaultKnowledgePackMetadataCandidates,
} from "@/lib/agents/defaultKnowledgePackMetadataCandidates";

export {
  evaluateKnowledgePackMetadataRegistryCandidate,
  resolveKnowledgePackMetadataRegistryCandidateDecision,
  validateMetadataCandidates,
} from "@/lib/agents/evaluateKnowledgePackMetadataRegistryCandidate";

export type {
  KnowledgePackMetadataCandidate,
  KnowledgePackMetadataCategory,
  KnowledgePackMetadataRegistryCandidateChecklistItem,
  KnowledgePackMetadataRegistryCandidateDecision,
  KnowledgePackMetadataRegistryCandidateFinding,
  KnowledgePackMetadataRegistryCandidateInput,
  KnowledgePackMetadataRegistryCandidateReport,
  KnowledgePackMetadataSourceType,
  KnowledgePackMetadataStatus,
} from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";

export {
  buildDefaultRoleKnowledgePackMappingCandidates,
  evaluateRoleKnowledgePackMappingCandidate,
  resolveRoleKnowledgePackMappingCandidateDecision,
  validateRoleKnowledgePackMappings,
} from "@/lib/agents/evaluateRoleKnowledgePackMappingCandidate";

export type {
  RoleKnowledgePackMappingCandidate,
  RoleKnowledgePackMappingCandidateChecklistItem,
  RoleKnowledgePackMappingCandidateDecision,
  RoleKnowledgePackMappingCandidateFinding,
  RoleKnowledgePackMappingCandidateInput,
  RoleKnowledgePackMappingCandidateReport,
} from "@/lib/agents/roleKnowledgePackMappingCandidateTypes";

export {
  buildDefaultPromptContextInjectionDesignCandidates,
  evaluatePromptContextInjectionDesignCandidate,
  resolvePromptContextInjectionDesignCandidateDecision,
  SUPPORTED_INJECTION_MODES,
  validatePromptContextInjectionDesigns,
} from "@/lib/agents/evaluatePromptContextInjectionDesignCandidate";

export type {
  PromptContextInjectionDesignCandidate,
  PromptContextInjectionDesignCandidateChecklistItem,
  PromptContextInjectionDesignCandidateDecision,
  PromptContextInjectionDesignCandidateFinding,
  PromptContextInjectionDesignCandidateInput,
  PromptContextInjectionDesignCandidateReport,
  PromptContextInjectionMode,
  PromptContextInjectionTiming,
  PromptContextMaxContextPolicy,
} from "@/lib/agents/promptContextInjectionDesignCandidateTypes";

export {
  buildStage5IntegratedKnowledgeFoundationClosureFingerprint,
  buildStage5IntegratedSourceDecisions,
  evaluateStage5IntegratedKnowledgeFoundationClosure,
  RECOMMENDED_NEXT_PHASES,
  resolveStage5IntegratedKnowledgeFoundationClosureDecision,
  SEPARATED_WORK_ITEMS,
} from "@/lib/agents/evaluateStage5IntegratedKnowledgeFoundationClosure";

export {
  buildStage5ReadyChainInput,
  extractStage5AClosureInput,
  toMappingEvaluatorInput,
  toMetadataRegistryEvaluatorInput,
  toPromptDesignEvaluatorInput,
} from "@/lib/agents/stage5KnowledgeFoundationInput";

export type { Stage5KnowledgeFoundationChainInput } from "@/lib/agents/stage5KnowledgeFoundationInput";

export {
  evaluateStage5KnowledgeFoundationPipeline,
} from "@/lib/agents/stage5KnowledgeFoundationPipeline";

export type { Stage5KnowledgeFoundationPipelineReports } from "@/lib/agents/stage5KnowledgeFoundationPipeline";

export type {
  Stage5IntegratedKnowledgeFoundationClosureChecklistItem,
  Stage5IntegratedKnowledgeFoundationClosureDecision,
  Stage5IntegratedKnowledgeFoundationClosureFinding,
  Stage5IntegratedKnowledgeFoundationClosureInput,
  Stage5IntegratedKnowledgeFoundationClosureReport,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";

export {
  evaluateRoleKnowledgeBindingReadiness,
  listDefaultKnowledgePackIds,
} from "@/lib/agents/evaluateRoleKnowledgeBindingReadiness";

export {
  appendRoleKnowledgeBindingInputHygieneFindings,
  buildRoleKnowledgeBindingInputHygieneChecklist,
  findUnknownKnowledgePackIds,
  normalizeAvailableKnowledgePackIds,
  sortedDefaultKnowledgePackIds,
  sortedKnowledgePackIds,
} from "@/lib/agents/roleKnowledgeBindingInputHygiene";

export {
  buildStage4ClosureBaselineFields,
  MULTI_AGENT_ORCHESTRATION_MVP_BASELINE,
  MULTI_AGENT_ORCHESTRATION_MVP_BASELINE_SUMMARY,
  resolveStage2Through4ClosureLocked,
  STAGE2_THROUGH4_CLOSED_STAGES,
  STAGE2_THROUGH4_CLOSURE_SCOPE,
  STAGE5_A_BOUNDARY_REPORT,
  STAGE5_ENTRY_CANDIDATES,
} from "@/lib/agents/multiAgentOrchestrationMvpBaseline";

export type { ConnectorPassThroughRecordSource } from "@/lib/agents/connectorPassThroughBoundaryTypes";

/** @internal Tests and registry bootstrap only. */
export { DEFAULT_AGENTS } from "@/lib/agents/defaultAgents";
export { DEFAULT_CAPABILITIES } from "@/lib/agents/defaultCapabilities";
export { DEFAULT_CONNECTORS } from "@/lib/agents/defaultConnectors";
export { DEFAULT_GOVERNANCE_POLICIES } from "@/lib/agents/defaultGovernancePolicies";
export { DEFAULT_CONNECTOR_PASS_THROUGH_BOUNDARIES } from "@/lib/agents/defaultConnectorPassThroughBoundaries";
