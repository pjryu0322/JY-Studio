/**
 * Agent Definition Model — foundation types for future Harness / Connector Gateway.
 * Does not replace platform AI member catalog or ProjectMember rows.
 */

export type AgentType =
  | "planner"
  | "analyst"
  | "architect"
  | "designer"
  | "developer"
  | "reviewer"
  | "security"
  | "scm"
  | "operator";

export type AgentRuntimeMode =
  | "llm"
  | "code_assistant"
  | "connector_worker"
  | "human_assisted"
  | "system";

/** Future Connector Gateway ids (Stage 1: registry only). */
export type ConnectorId = "cursor" | "github" | "codex" | "copilot" | "openai";

export interface AgentInputContract {
  readonly requiredContext: readonly string[];
  readonly optionalContext?: readonly string[];
  readonly acceptedArtifacts?: readonly string[];
}

export interface AgentOutputContract {
  readonly outputTypes: readonly string[];
  readonly requiredFields?: readonly string[];
  readonly qualityChecks?: readonly string[];
}

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: AgentType;
  readonly description: string;
  readonly runtimeMode: AgentRuntimeMode;
  readonly responsibilities: readonly string[];
  readonly defaultCapabilities: readonly string[];
  readonly allowedConnectors: readonly ConnectorId[];
  readonly inputContract: AgentInputContract;
  readonly outputContract: AgentOutputContract;
  readonly governanceProfile?: string;
  readonly promptProfile?: string;
  readonly knowledgePackRefs?: readonly string[];
  readonly enabled: boolean;
}
