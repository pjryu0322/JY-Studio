/**
 * Connector Descriptor / Boundary — pre-Gateway model (no API calls).
 */

export type ConnectorType =
  | "cursor"
  | "github"
  | "codex"
  | "copilot"
  | "openai"
  | "filesystem"
  | "terminal"
  | "custom";

export interface ConnectorDescriptor {
  readonly id: string;
  readonly type: ConnectorType;
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly authorityProfile?: string;
}

export interface AgentConnectorBoundary {
  readonly agentId: string;
  readonly allowedConnectorIds: readonly string[];
  readonly deniedConnectorIds?: readonly string[];
  readonly notes?: string;
}
