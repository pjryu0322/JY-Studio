/**
 * Agent Harness Dry-run — pre-execution plan types (no Agent/Connector execution).
 */

import type { ConnectorInvocationResult } from "@/lib/agents/connectorGatewayFacadeTypes";
import type { GovernancePrecheckDryRunResult } from "@/lib/agents/governancePrecheckDryRunTypes";

export type HarnessDryRunStatus =
  | "planned"
  | "blocked"
  | "warning"
  | "no_agent"
  | "no_capability";

export type HarnessDryRunSource =
  | "single_chat"
  | "requirements"
  | "runtime"
  | "governance"
  | "manual";

export interface HarnessDryRunRequest {
  readonly intent?: string;
  readonly action?: string;
  readonly stage?: string;
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly runtimeRole?: string;
  readonly aiMemberRole?: string;
  readonly projectId?: string;
  readonly conversationId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly source?: HarnessDryRunSource;
}

export type HarnessGovernancePrecheckStatus =
  | "not_evaluated"
  | "pass_candidate"
  | "warning"
  | "blocked";

export interface HarnessGovernancePrecheck {
  readonly requiredChecks: readonly string[];
  readonly status: HarnessGovernancePrecheckStatus;
  readonly warnings?: readonly string[];
  readonly blockingReasons?: readonly string[];
}

export interface HarnessGovernanceDryRunSummary {
  readonly status: GovernancePrecheckDryRunResult["status"];
  readonly evaluatedPolicyCount: number;
  readonly findingCount: number;
  readonly warningCount: number;
  readonly blockingCandidateCount: number;
}

export interface HarnessDryRunResult {
  readonly status: HarnessDryRunStatus;
  readonly executable: boolean;
  readonly agentId?: string;
  readonly agentType?: string;
  readonly capabilityId?: string;
  readonly requiredConnectors: readonly string[];
  readonly connectorPlans: readonly ConnectorInvocationResult[];
  readonly governancePrecheck: HarnessGovernancePrecheck;
  readonly governanceDryRun?: GovernancePrecheckDryRunResult;
  readonly governanceDryRunSummary?: HarnessGovernanceDryRunSummary;
  readonly reason: string;
  readonly warnings: readonly string[];
  readonly blockingReasons: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
