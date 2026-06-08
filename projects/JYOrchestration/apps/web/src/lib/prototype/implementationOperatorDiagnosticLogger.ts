import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ImplementationOperatorDiagnosticEventV1 = Readonly<{
  readonly action:
    | "implementation_codetask_authoritative_outcome_resolved"
    | "implementation_codetask_user_safe_failure_built"
    | "implementation_codetask_operator_diagnostic_logged";
  readonly projectId: string;
  readonly unitId?: string | null;
  readonly codeTaskId?: string | null;
  readonly processTaskId?: string | null;
  readonly runId?: string | null;
  readonly workBranch?: string | null;
  readonly baseBranch?: string | null;
  readonly candidateBranches?: readonly string[];
  readonly apiStatus?: number | null;
  readonly reason?: string | null;
  readonly outcomeStatus?: string | null;
  readonly retryable?: boolean | null;
  readonly changedFileCount?: number | null;
  readonly traceGroup?: string | null;
  readonly createdAt: string;
}>;

const OPERATOR_DIAGNOSTIC_FAILURE_REASONS = new Set([
  "github_branch_missing",
  "github_no_new_commit",
  "commit_not_created",
  "github_verify_failed",
  "github_verify_state_sync_failed",
  "github_api_error",
  "github_verify_timeout",
  "cursor_api_launch_failed",
]);

export function shouldPersistOperatorDiagnosticForFailure(input: {
  readonly outcomeStatus?: string | null;
  readonly reason?: string | null;
  readonly unitStatus?: string | null;
  readonly authoritativeStatus?: string | null;
}): boolean {
  if (input.authoritativeStatus === "failed" || input.unitStatus === "failed") return true;
  if (input.outcomeStatus === "failed") return true;
  const reason = String(input.reason ?? "").trim();
  if (reason && OPERATOR_DIAGNOSTIC_FAILURE_REASONS.has(reason)) return true;
  return false;
}

export function buildCodeTaskOperatorDiagnosticTimelineEntry(input: {
  readonly projectId: string;
  readonly unitId?: string | null;
  readonly codeTaskId?: string | null;
  readonly processTaskId?: string | null;
  readonly runId?: string | null;
  readonly workBranch?: string | null;
  readonly baseBranch?: string | null;
  readonly candidateBranches?: readonly string[] | null;
  readonly apiStatus?: number | null;
  readonly reason?: string | null;
  readonly outcomeStatus?: string | null;
  readonly retryable?: boolean | null;
  readonly changedFileCount?: number | null;
  readonly traceGroup?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const candidates = (input.candidateBranches ?? [])
    .map((b) => String(b ?? "").trim())
    .filter(Boolean);
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_codetask_operator_diagnostic_logged",
    orchestrationTraceGroup: input.traceGroup ?? "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      unitId: input.unitId,
      codeTaskId: input.codeTaskId,
      processTaskId: input.processTaskId,
      runId: input.runId,
      workBranch: input.workBranch,
      baseBranch: input.baseBranch,
      candidateBranches: candidates.length ? candidates.join(",") : undefined,
      apiStatus: input.apiStatus ?? undefined,
      reason: input.reason,
      outcomeStatus: input.outcomeStatus,
      retryable: input.retryable ?? undefined,
      changedFileCount: input.changedFileCount ?? undefined,
      traceGroup: input.traceGroup ?? "implementation_orchestration",
    },
    nowIso,
  });
}
