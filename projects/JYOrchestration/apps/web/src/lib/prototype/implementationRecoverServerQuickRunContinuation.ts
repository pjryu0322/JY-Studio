import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  postContinueQuickRun,
  type DbQueuedQuickRunAutoDispatchResultV1,
} from "@/lib/prototype/implementationDbQueuedQuickRunContinuation";
import {
  parseImplementationQuickRunV1,
} from "@/lib/prototype/implementationQuickRun";
import { parseImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { shouldPlanQuickRunCodeTaskContinuationAfterAutoGate } from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import {
  isActiveTaskCursorExecution,
  parseTaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/promptTimelineState";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

const RECENT_SERVER_CONTINUATION_WINDOW_MS = 120_000;
const RECENT_TIMELINE_TAIL = 40;

export function hasRecentServerQuickRunContinuationTimeline(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const entries = timeline ?? [];
  return entries.some((entry, idx) => {
    if (idx < entries.length - RECENT_TIMELINE_TAIL) return false;
    const action = String(entry.action ?? "");
    if (
      action !== "quick_run_next_dispatch_executed" &&
      action !== "quick_run_next_dispatch_planned"
    ) {
      return false;
    }
    const created = Date.parse(String(entry.createdAt ?? ""));
    return Number.isFinite(created) && nowMs - created < RECENT_SERVER_CONTINUATION_WINDOW_MS;
  });
}

export function shouldRecoverServerQuickRunContinuation(input: {
  readonly requirementsState: RequirementsStateJson;
  readonly promptTimeline: readonly RequirementsPromptTimelineEntry[] | null | undefined;
  readonly fallbackRunsV1: unknown;
  readonly implementationRuntimeDbBundle: ImplementationRuntimeBundleView | null;
}): boolean {
  if (hasRecentServerQuickRunContinuationTimeline(input.promptTimeline)) {
    return false;
  }

  const execution = parseTaskCursorExecutionV1(input.requirementsState.taskCursorExecutionV1);
  const autoGate = parseImplementationAutoQualityGateV1(
    input.requirementsState.implementationAutoQualityGateV1,
  );
  const quickRun = parseImplementationQuickRunV1(input.requirementsState.implementationQuickRunV1);
  const runs =
    parseCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1) ??
    parseCodeTaskExecutionRunsV1(input.fallbackRunsV1) ??
    [];

  if (
    !execution ||
    !autoGate ||
    autoGate.status !== "passed" ||
    !quickRun ||
    !shouldPlanQuickRunCodeTaskContinuationAfterAutoGate({
      quickRun,
      taskCursorExecution: execution,
      autoGate,
      runs,
      codeTaskPlan: input.requirementsState.implementationCodeTaskPlanV1,
      taskList: input.requirementsState.implementationTaskListV1,
      cursorWorkItems: input.requirementsState.cursorWorkItemsV1,
      dbBundle: input.implementationRuntimeDbBundle,
    })
  ) {
    return false;
  }

  if (isActiveTaskCursorExecution(execution)) {
    return false;
  }

  return true;
}

export async function recoverServerQuickRunContinuation(input: {
  readonly projectId: string;
}): Promise<DbQueuedQuickRunAutoDispatchResultV1> {
  return postContinueQuickRun({
    projectId: input.projectId,
    mode: "recover_missing_server_continuation",
  });
}
