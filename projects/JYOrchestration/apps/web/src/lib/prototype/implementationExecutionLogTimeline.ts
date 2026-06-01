import type { TaskCursorAutoChainDecision } from "@/lib/prototype/implementationTaskCursorAutoChain";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ImplementationExecutionLogTimelineAction =
  | "task_cursor_auto_chain_started"
  | "task_cursor_auto_chain_continued"
  | "task_cursor_auto_chain_continued_after_failure"
  | "task_cursor_auto_chain_blocked"
  | "task_cursor_poll_loop_started"
  | "task_cursor_poll_tick"
  | "task_cursor_poll_cancelled"
  | "task_cursor_poll_resumed"
  | "task_cursor_poll_timeout";

function flattenTimelineFieldValue(value: string | number | boolean | undefined | null): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value).replace(/\s+/g, " ").trim();
}

export function buildImplementationExecutionLogTimelineEntry(input: {
  readonly action: string;
  readonly orchestrationTraceGroup?: string;
  readonly source?: RequirementsPromptTimelineEntry["source"];
  readonly routingDecision?: string;
  readonly fields?: Readonly<Record<string, string | number | boolean | undefined | null>>;
  readonly detailLines?: readonly string[];
  readonly promptText?: string;
  readonly error?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const fieldParts = Object.entries(input.fields ?? {})
    .flatMap(([key, value]) => {
      const formatted = flattenTimelineFieldValue(value);
      return formatted ? [`${key}=${formatted}`] : [];
    });
  const responseText = [`type=${input.action}`, ...fieldParts, ...(input.detailLines ?? [])].join(" ");
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: input.source ?? "platform",
    routingDecision: input.routingDecision,
    responseText,
    promptText: input.promptText,
    error: input.error,
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: input.orchestrationTraceGroup ?? "implementation_orchestration",
  };
}

export function appendImplementationExecutionLogTimeline(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  ...entries: readonly RequirementsPromptTimelineEntry[]
): RequirementsPromptTimelineEntry[] {
  return entries.reduce(
    (acc, entry) => appendPromptTimeline(acc, entry),
    [...(existing ?? [])],
  );
}

export function buildPromptTimelineOrchestrationPatch(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  ...entries: readonly RequirementsPromptTimelineEntry[]
): Readonly<{ readonly promptTimeline: readonly RequirementsPromptTimelineEntry[] }> {
  return {
    promptTimeline: appendImplementationExecutionLogTimeline(existing, ...entries),
  };
}

export function buildTaskCursorAutoChainTimelineEntry(input: {
  readonly decision: Exclude<TaskCursorAutoChainDecision, Readonly<{ readonly kind: "none" }>>;
  readonly notice?: string;
  readonly triggerActionOutcome?: "executed" | "blocked" | "no_op";
  readonly message?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const { decision } = input;
  const action: ImplementationExecutionLogTimelineAction =
    decision.kind === "start"
      ? "task_cursor_auto_chain_started"
      : decision.kind === "continue"
        ? "task_cursor_auto_chain_continued"
        : "task_cursor_auto_chain_continued_after_failure";

  const fields: Record<string, string | number> = { kind: decision.kind };
  if (decision.kind === "start") {
    fields.taskId = decision.taskId;
  } else if (decision.kind === "continue") {
    fields.fromTaskId = decision.fromTaskId;
    fields.toTaskId = decision.toTaskId;
  } else {
    fields.failedTaskId = decision.failedTaskId;
    fields.toTaskId = decision.toTaskId;
    fields.blockedTaskIds = decision.blockedTaskIds.join(",");
    fields.blockedTaskCount = decision.blockedTaskIds.length;
  }
  if (input.triggerActionOutcome) {
    fields.triggerActionOutcome = input.triggerActionOutcome;
  }

  return buildImplementationExecutionLogTimelineEntry({
    action:
      input.triggerActionOutcome === "blocked" || input.triggerActionOutcome === "no_op"
        ? "task_cursor_auto_chain_blocked"
        : action,
    orchestrationTraceGroup: "task_cursor_execution",
    routingDecision:
      decision.kind === "start" ? decision.taskId : decision.toTaskId,
    fields,
    detailLines: [
      ...(input.notice ? [`notice=${input.notice.replace(/\n/g, " | ")}`] : []),
      ...(input.message ? [`message=${input.message.replace(/\s+/g, " ").slice(0, 240)}`] : []),
    ],
    nowIso: input.nowIso,
  });
}

export function buildTaskCursorJobLifecycleTimelineEntry(input: {
  readonly action:
    | "task_cursor_job_created"
    | "task_cursor_job_claimed"
    | "task_cursor_job_tick"
    | "task_cursor_job_completed"
    | "task_cursor_job_failed"
    | "task_cursor_job_timeout"
    | "task_cursor_job_cancelled";
  readonly projectId: string;
  readonly taskId: string;
  readonly jobId?: string;
  readonly status?: string;
  readonly pollCount?: number;
  readonly message?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: input.action,
    orchestrationTraceGroup: "task_cursor_execution",
    routingDecision: input.taskId,
    fields: {
      projectId: input.projectId,
      taskId: input.taskId,
      ...(input.jobId ? { jobId: input.jobId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.pollCount != null ? { pollCount: input.pollCount } : {}),
      ...(input.message ? { message: input.message } : {}),
    },
    nowIso: input.nowIso,
  });
}

export function buildTaskCursorPollLifecycleTimelineEntry(input: {
  readonly action:
    | "task_cursor_poll_loop_started"
    | "task_cursor_poll_tick"
    | "task_cursor_poll_cancelled"
    | "task_cursor_poll_resumed"
    | "task_cursor_poll_timeout";
  readonly projectId: string;
  readonly taskId: string;
  readonly runId?: string;
  readonly round?: number;
  readonly agentStatus?: string;
  readonly executionStatus?: string;
  readonly message?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: input.action,
    orchestrationTraceGroup: "task_cursor_execution",
    routingDecision: input.taskId,
    fields: {
      projectId: input.projectId,
      taskId: input.taskId,
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.round != null ? { round: input.round } : {}),
      ...(input.agentStatus ? { agentStatus: input.agentStatus } : {}),
      ...(input.executionStatus ? { executionStatus: input.executionStatus } : {}),
      ...(input.message ? { message: input.message } : {}),
    },
    nowIso: input.nowIso,
  });
}
