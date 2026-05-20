/**
 * Agent runtime metadata persistence candidates (readiness only — no DB/Timeline wire).
 */

export const AGENT_RUNTIME_METADATA_SCHEMA_VERSION = "agent-runtime-metadata.v1" as const;
export const AGENT_RUNTIME_REGISTRY_VERSION = "multi-agent-foundation.v1" as const;

export type AgentRuntimePersistenceCandidateKind =
  | "timeline_metadata"
  | "replay_snapshot"
  | "diagnostic_metadata";

export interface AgentConnectorPlanSummary {
  readonly connectorId: string;
  readonly status: string;
  readonly mode: string;
  readonly allowed: boolean;
  readonly reason: string;
}

export interface AgentGovernanceDryRunPersistenceSummary {
  readonly status: string;
  readonly requiredChecks: readonly string[];
  readonly evaluatedPolicyIds: readonly string[];
  readonly findingCount: number;
  readonly warningCount: number;
  readonly blockingCandidateCount: number;
}

export interface AgentConnectorPassThroughSummary {
  readonly boundaryId: string;
  readonly connectorId: string;
  readonly operation: string;
  readonly allowed: boolean;
  readonly reason: string;
}

export interface AgentRuntimePersistenceCandidate {
  readonly schemaVersion: typeof AGENT_RUNTIME_METADATA_SCHEMA_VERSION;
  readonly registryVersion: typeof AGENT_RUNTIME_REGISTRY_VERSION;
  readonly kind: AgentRuntimePersistenceCandidateKind;

  readonly source?: string;
  readonly projectId?: string;
  readonly conversationId?: string;
  readonly runId?: string;
  readonly taskId?: string;

  readonly agentId?: string;
  readonly agentType?: string;
  readonly capabilityId?: string;

  readonly harnessStatus?: string;
  readonly executable?: boolean;
  readonly reason?: string;

  readonly connectorPlanSummary?: readonly AgentConnectorPlanSummary[];
  readonly governanceSummary?: AgentGovernanceDryRunPersistenceSummary;
  readonly passThroughRecordSummary?: readonly AgentConnectorPassThroughSummary[];

  readonly warnings?: readonly string[];
  readonly blockingReasons?: readonly string[];

  readonly createdAt?: string;
}
