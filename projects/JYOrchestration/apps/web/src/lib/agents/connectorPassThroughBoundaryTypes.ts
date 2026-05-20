/**
 * Connector pass-through boundary types (record-only; no execution routing).
 */

export const CONNECTOR_PASS_THROUGH_RECORD_SCHEMA_VERSION =
  "connector-pass-through-record.v1" as const;

export type ConnectorPassThroughBoundaryKind =
  | "cursor_execution"
  | "github_pr"
  | "github_branch"
  | "github_merge"
  | "github_status"
  | "requirements_dispatch"
  | "manual";

export interface ConnectorPassThroughBoundary {
  readonly id: string;
  readonly kind: ConnectorPassThroughBoundaryKind;
  readonly connectorId: string;
  readonly operation: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly recordOnly: true;
}

export type ConnectorPassThroughRecordSource =
  | "harness"
  | "manual"
  | "requirements"
  | "runtime"
  | "diagnostic";

export interface ConnectorPassThroughRecordCandidate {
  readonly schemaVersion: typeof CONNECTOR_PASS_THROUGH_RECORD_SCHEMA_VERSION;
  readonly boundaryId: string;
  readonly connectorId: string;
  readonly operation: string;
  readonly mode: "pass_through";
  readonly recordOnly: true;
  readonly source?: ConnectorPassThroughRecordSource;
  readonly createdAt?: string;

  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly projectId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly conversationId?: string;

  readonly facadeStatus?: string;
  readonly allowed?: boolean;
  readonly reason?: string;
  readonly warnings?: readonly string[];
}
