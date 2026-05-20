/**
 * Read-only diagnostic view model for Multi-Agent Runtime dry-run (no execution/storage).
 */

export type AgentRuntimeDiagnosticViewMode = "read_only_dry_run";

export const AGENT_RUNTIME_DIAGNOSTIC_TITLE =
  "Multi-Agent Runtime 진단 (Dry-run)" as const;

export const AGENT_RUNTIME_DIAGNOSTIC_DISCLAIMER =
  "이 화면은 Multi-Agent Runtime dry-run 진단 정보입니다. 실제 Agent 실행, Connector 호출, Governance 차단, Timeline/Replay 저장은 수행하지 않습니다." as const;

export interface HarnessDiagnosticSection {
  readonly status?: string;
  readonly executable?: boolean;
  readonly agentId?: string;
  readonly agentType?: string;
  readonly capabilityId?: string;
  readonly reason?: string;
  readonly requiredConnectors: readonly string[];
}

export interface GovernanceDiagnosticSection {
  readonly status?: string;
  readonly requiredChecks: readonly string[];
  readonly evaluatedPolicyIds: readonly string[];
  readonly findingCount: number;
  readonly warningCount: number;
  readonly blockingCandidateCount: number;
}

export interface PersistenceCandidateDiagnosticSection {
  readonly schemaVersion?: string;
  readonly registryVersion?: string;
  readonly kind?: string;
  readonly valid: boolean;
  readonly validationWarnings: readonly string[];
  readonly jsonSize: number;
}

export interface PassThroughDiagnosticRecordRow {
  readonly boundaryId: string;
  readonly connectorId: string;
  readonly operation: string;
  readonly mode: string;
  readonly recordOnly: boolean;
  readonly allowed?: boolean;
  readonly reason?: string;
  readonly source?: string;
  readonly createdAt?: string;
}

export interface PassThroughDiagnosticSection {
  readonly boundaryCount: number;
  readonly records: readonly PassThroughDiagnosticRecordRow[];
}

export interface AgentRuntimeDiagnosticViewModel {
  readonly mode: AgentRuntimeDiagnosticViewMode;
  readonly title: string;
  readonly disclaimer: string;

  readonly harness?: HarnessDiagnosticSection;
  readonly governance?: GovernanceDiagnosticSection;
  readonly persistenceCandidate?: PersistenceCandidateDiagnosticSection;
  readonly passThrough?: PassThroughDiagnosticSection;

  readonly warnings: readonly string[];
}
