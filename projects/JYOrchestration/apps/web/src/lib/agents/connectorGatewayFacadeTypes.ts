/**
 * Connector Gateway Facade — dry-run / pass-through planning types (no external calls).
 */

export type ConnectorInvocationMode = "dry_run" | "pass_through" | "disabled";

export type ConnectorInvocationStatus =
  | "planned"
  | "skipped"
  | "blocked"
  | "passed_through"
  | "failed";

export interface ConnectorInvocationRequest {
  readonly connectorId: string;
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly mode: ConnectorInvocationMode;
  readonly operation: string;
  readonly reason?: string;
  readonly projectId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly conversationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConnectorInvocationResult {
  readonly connectorId: string;
  readonly status: ConnectorInvocationStatus;
  readonly mode: ConnectorInvocationMode;
  readonly operation: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly warnings?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
