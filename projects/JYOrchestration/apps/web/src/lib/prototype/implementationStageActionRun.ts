import type {
  ImplementationStageActionGateResult,
  ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationActionId } from "@/lib/prototype/implementationIntentRouterTypes";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ImplementationStageActionRunSource = "cta" | "natural_language" | "system";

export type ImplementationStageActionRunStatus =
  | "routed"
  | "blocked"
  | "running"
  | "succeeded"
  | "failed"
  | "no_op"
  | "deferred";

export type ImplementationStageActionRun = Readonly<{
  runId: string;
  projectId: string;
  actionId: ImplementationStageActionId;
  source: ImplementationStageActionRunSource;
  status: ImplementationStageActionRunStatus;
  gateResult?: ImplementationStageActionGateResult;
  runResult?: ImplementationStageActionRunResult;
  message?: string;
  startedAt: string;
  completedAt?: string;
  timelineEntries: readonly RequirementsPromptTimelineEntry[];
}>;

export type ImplementationStageActionRunLogV1 = Readonly<{
  version: "implementation_stage_action_run_log_v1";
  runs: readonly ImplementationStageActionRun[];
  updatedAt: string;
}>;

export function buildImplementationStageActionRunDebugSummary(
  log: ImplementationStageActionRunLogV1 | null | undefined,
): string {
  const runs = log?.runs ?? [];
  if (!runs.length) return "최근 실행 이력이 없습니다.";
  const latest = runs[0];
  const blocked = runs.find((r) => r.status === "blocked" || r.status === "failed" || r.status === "no_op") ?? null;
  const lines = [
    `최근 실행: ${latest.actionId} · ${latest.status}`,
    blocked
      ? `최근 차단: ${blocked.actionId} · ${blocked.status}${blocked.message ? ` · ${blocked.message}` : ""}`
      : "최근 차단: 없음",
  ];
  return lines.join("\n");
}

export function createImplementationStageActionRunId(input?: {
  readonly nowIso?: string;
  readonly actionId?: ImplementationStageActionId;
}): string {
  const now = input?.nowIso ?? new Date().toISOString();
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `impl-run-${now.replace(/[^0-9]/g, "").slice(0, 14)}-${random}`;
}

export function createImplementationStageActionRun(input: {
  readonly projectId: string;
  readonly actionId: ImplementationStageActionId;
  readonly source: ImplementationStageActionRunSource;
  readonly nowIso?: string;
}): ImplementationStageActionRun {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    runId: createImplementationStageActionRunId({
      nowIso: now,
      actionId: input.actionId,
    }),
    projectId: input.projectId,
    actionId: input.actionId,
    source: input.source,
    status: "routed",
    startedAt: now,
    timelineEntries: [],
  };
}

export function statusFromImplementationStageActionRunResult(
  runResult: ImplementationStageActionRunResult,
): ImplementationStageActionRunStatus {
  switch (runResult.outcome) {
    case "executed":
      return "succeeded";
    case "blocked":
      return "blocked";
    case "no_op":
      return "no_op";
  }
}

export function completeImplementationStageActionRun(input: {
  readonly run: ImplementationStageActionRun;
  readonly gateResult?: ImplementationStageActionGateResult;
  readonly runResult?: ImplementationStageActionRunResult;
  readonly status?: ImplementationStageActionRunStatus;
  readonly message?: string;
  readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
  readonly completedAt?: string;
}): ImplementationStageActionRun {
  const completedAt = input.completedAt ?? new Date().toISOString();
  let status = input.status;
  let message = input.message;

  if (!status) {
    if (input.gateResult && !input.gateResult.ok) {
      status = "blocked";
      message = message ?? input.gateResult.message;
    } else if (input.runResult) {
      status = statusFromImplementationStageActionRunResult(input.runResult);
      if (input.runResult.outcome === "blocked") {
        message = message ?? input.runResult.message;
      } else if (input.runResult.outcome === "no_op") {
        message = message ?? input.runResult.message;
      }
    } else {
      status = "succeeded";
    }
  }

  return {
    ...input.run,
    status,
    gateResult: input.gateResult,
    runResult: input.runResult,
    message,
    completedAt,
    timelineEntries: input.timelineEntries ?? input.run.timelineEntries,
  };
}

export function appendImplementationStageActionRunToLog(input: {
  readonly currentLog?: ImplementationStageActionRunLogV1 | null;
  readonly run: ImplementationStageActionRun;
  readonly maxRuns?: number;
  readonly nowIso?: string;
}): ImplementationStageActionRunLogV1 {
  const maxRuns = input.maxRuns ?? 50;
  const now = input.nowIso ?? new Date().toISOString();
  const currentRuns = input.currentLog?.runs ?? [];
  const runs = [input.run, ...currentRuns.filter((r) => r.runId !== input.run.runId)].slice(0, maxRuns);
  return {
    version: "implementation_stage_action_run_log_v1",
    runs,
    updatedAt: now,
  };
}

export function buildImplementationStageActionRunLogPatch(input: {
  readonly currentLog?: ImplementationStageActionRunLogV1 | null;
  readonly run: ImplementationStageActionRun;
  readonly nowIso?: string;
}): { readonly implementationStageActionRunLogV1: ImplementationStageActionRunLogV1 } {
  return {
    implementationStageActionRunLogV1: appendImplementationStageActionRunToLog({
      currentLog: input.currentLog,
      run: input.run,
      nowIso: input.nowIso,
    }),
  };
}

export function canRouteImplementationIntentThroughStageOrchestrator(
  actionId: ImplementationActionId | null | undefined,
): boolean {
  return mapImplementationRouterActionToStageAction(actionId) != null;
}

export function coerceImplementationStageActionRunLogV1(
  raw: unknown,
): ImplementationStageActionRunLogV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== "implementation_stage_action_run_log_v1") return null;
  const runsRaw = Array.isArray(o.runs) ? (o.runs as unknown[]) : null;
  if (!runsRaw) return null;
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : null;
  if (!updatedAt) return null;
  // Minimal runtime validation; keep structure for persistence.
  const runs = runsRaw.filter((r) => Boolean(r)) as ImplementationStageActionRun[];
  return {
    version: "implementation_stage_action_run_log_v1",
    runs,
    updatedAt,
  };
}

/** Phase 7: connect router actions to stage action pipeline. */
export function mapImplementationRouterActionToStageAction(
  actionId: ImplementationActionId | null | undefined,
): ImplementationStageActionId | null {
  switch (actionId) {
    case "CREATE_WORK_PLAN":
      return "GENERATE_IMPLEMENTATION_WORK_PLAN";
    case "CONFIRM_WORK_PLAN":
      return "CONFIRM_IMPLEMENTATION_WORK_PLAN";
    case "CONFIRM_MOCK_IMPLEMENTATION":
      return "CONFIRM_MOCK_IMPLEMENTATION";
    case "REVIEW_DB_INTEGRATION":
      return "REVIEW_DB_INTEGRATION";
    case "REQUEST_CODE_AGENT_WIP":
      return "REQUEST_CODE_AGENT_WIP";
    case "SHOW_SCM_CHECK":
      return "SHOW_SCM_CHECK";
    case "SHOW_ENV_CHECK":
      return "SHOW_ENV_CHECK";
    case "SHOW_ROLE_CHECK":
      return "SHOW_ROLE_CHECK";
    case "OPEN_ENV_SETTINGS":
      return "OPEN_ENV_SETTINGS";
    case "SHOW_ARTIFACTS":
      return "SHOW_ARTIFACTS";
    default:
      return null;
  }
}
