import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { AuthoritativeCodeTaskOutcomeV1 } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";

export function buildAuthoritativeOutcomeResolvedLogEntry(input: {
  readonly projectId: string;
  readonly outcome: AuthoritativeCodeTaskOutcomeV1;
  readonly workBranch?: string | null;
  readonly baseBranch?: string | null;
  readonly apiStatus?: string | number | null;
  readonly candidateBranches?: string | null;
  readonly traceGroup?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_codetask_authoritative_outcome_resolved",
    orchestrationTraceGroup: input.traceGroup ?? "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      unitId: input.outcome.unitId,
      codeTaskId: input.outcome.codeTaskId,
      processTaskId: input.outcome.processTaskId,
      runId: input.outcome.latestRunId,
      workBranch: input.workBranch,
      baseBranch: input.baseBranch,
      apiStatus: input.apiStatus,
      candidateBranches: input.candidateBranches,
      reason: input.outcome.failureReason,
      outcomeStatus: input.outcome.latestOutcomeStatus,
      authoritativeStatus: input.outcome.status,
    },
    nowIso: input.nowIso,
  });
}

export function buildUserSafeFailureBuiltLogEntry(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly processTaskId: string | null;
  readonly userSafeTitle: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_codetask_user_safe_failure_built",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      codeTaskId: input.codeTaskId,
      processTaskId: input.processTaskId,
      userSafeTitle: input.userSafeTitle,
    },
    nowIso: input.nowIso,
  });
}

export function buildOperatorDiagnosticLoggedEntry(input: {
  readonly projectId: string;
  readonly fields: Readonly<Record<string, string | number | boolean | undefined | null>>;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_codetask_operator_diagnostic_logged",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: { projectId: input.projectId, ...input.fields },
    nowIso: input.nowIso,
  });
}

export function buildIntegrationGateBlockedByFailedCodeTaskLogEntry(input: {
  readonly projectId: string;
  readonly failedCodeTaskIds: readonly string[];
  readonly failedCount: number;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_integration_gate_blocked_by_failed_codetask",
    orchestrationTraceGroup: "implementation_integration",
    fields: {
      projectId: input.projectId,
      failedCodeTaskIds: input.failedCodeTaskIds.join(","),
      failedCount: input.failedCount,
    },
    nowIso: input.nowIso,
  });
}

export function buildCodeTaskRetryBlockedLogEntry(input: {
  readonly projectId: string;
  readonly reason: string;
  readonly unitId: string | null;
  readonly codeTaskId: string;
  readonly runId: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_codetask_retry_blocked",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      reason: input.reason,
      unitId: input.unitId,
      codeTaskId: input.codeTaskId,
      runId: input.runId,
    },
    nowIso: input.nowIso,
  });
}
