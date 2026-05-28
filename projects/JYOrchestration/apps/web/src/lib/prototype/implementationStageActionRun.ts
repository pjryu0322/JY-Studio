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

/** Phase 7: connect router actions to stage action pipeline. */
export function mapImplementationRouterActionToStageAction(
  actionId: ImplementationActionId | null | undefined,
): ImplementationStageActionId | null {
  switch (actionId) {
    case "CREATE_WORK_PLAN":
      return "GENERATE_IMPLEMENTATION_WORK_PLAN";
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
