import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { AuthoritativeCodeTaskOutcomeV1 } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import { buildCodeTaskOperatorDiagnosticTimelineEntry } from "@/lib/prototype/implementationOperatorDiagnosticLogger";
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
  return buildCodeTaskOperatorDiagnosticTimelineEntry({
    projectId: input.projectId,
    unitId: input.fields.unitId as string | null | undefined,
    codeTaskId: input.fields.codeTaskId as string | null | undefined,
    processTaskId: input.fields.processTaskId as string | null | undefined,
    runId: input.fields.runId as string | null | undefined,
    workBranch: input.fields.workBranch as string | null | undefined,
    baseBranch: input.fields.baseBranch as string | null | undefined,
    apiStatus: typeof input.fields.apiStatus === "number" ? input.fields.apiStatus : null,
    reason: input.fields.reason as string | null | undefined,
    outcomeStatus: input.fields.outcomeStatus as string | null | undefined,
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

export function buildCodeTaskRetryPreparedLogEntry(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly unitId: string;
  readonly previousOutcomeStatus: string | null;
  readonly previousReason: string | null;
  readonly runId?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_codetask_retry_prepared",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      codeTaskId: input.codeTaskId,
      unitId: input.unitId,
      previousOutcomeStatus: input.previousOutcomeStatus,
      previousReason: input.previousReason,
      runId: input.runId,
    },
    nowIso: input.nowIso,
  });
}

export function buildCodeTaskRetryPrepareFailedLogEntry(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly reason: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_codetask_retry_prepare_failed",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      codeTaskId: input.codeTaskId,
      reason: input.reason,
    },
    nowIso: input.nowIso,
  });
}
