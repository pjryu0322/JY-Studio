import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { parseImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { deriveImplementationEntryState } from "@/lib/prototype/implementationEntryState";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import {
  coerceImplementationStageActionRunLogV1,
  type ImplementationStageActionRun,
} from "@/lib/prototype/implementationStageActionRun";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { appendPromptTimelineEntriesOnce, buildPromptTimelineEntryFingerprint } from "@/lib/requirements/promptTimelineState";
import { pickPersistentExecutionLogTimelineEntries } from "@/lib/prototype/promptTimelineExecutionLogTabs";
import type {
  RequirementsPromptTimelineEntry,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";

function readCodeAgentWipSnapshot(raw: unknown): CodeAgentWipExecutionV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== "code_agent_wip_execution_v1") return null;
  const projectId = String(o.projectId ?? "").trim();
  const status = String(o.status ?? "").trim();
  if (!projectId || !status) return null;
  return raw as CodeAgentWipExecutionV1;
}

function readTaskExecutionFingerprint(
  state: ImplementationTaskExecutionStateV1 | null | undefined,
): string {
  if (!state?.items?.length) return "";
  return state.items
    .map((item) => `${item.taskId}:${item.status}:${item.errorMessage ?? ""}`)
    .sort()
    .join("|");
}

function readLatestStageActionRun(
  raw: unknown,
): ImplementationStageActionRun | null {
  const log = coerceImplementationStageActionRunLogV1(raw);
  return log?.runs?.[0] ?? null;
}

function pushIfChanged(
  entries: RequirementsPromptTimelineEntry[],
  entry: RequirementsPromptTimelineEntry,
): void {
  entries.push(entry);
}

export function buildImplementationOrchestrationChangeTimelineEntries(input: {
  readonly prior: RequirementsStateJson;
  readonly next: RequirementsStateJson;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const now = input.nowIso ?? new Date().toISOString();
  const entries: RequirementsPromptTimelineEntry[] = [];

  const priorCursor = parseTaskCursorExecutionV1(input.prior.taskCursorExecutionV1);
  const nextCursor = parseTaskCursorExecutionV1(input.next.taskCursorExecutionV1);
  if (
    nextCursor &&
    (!priorCursor ||
      priorCursor.taskId !== nextCursor.taskId ||
      priorCursor.status !== nextCursor.status ||
      priorCursor.cursorRunId !== nextCursor.cursorRunId ||
      priorCursor.commitSha !== nextCursor.commitSha ||
      priorCursor.failureReason !== nextCursor.failureReason ||
      priorCursor.errorMessage !== nextCursor.errorMessage)
  ) {
    pushIfChanged(
      entries,
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_task_cursor_state_changed",
        orchestrationTraceGroup: "task_cursor_execution",
        routingDecision: nextCursor.taskId,
        fields: {
          projectId: nextCursor.projectId,
          taskId: nextCursor.taskId,
          status: nextCursor.status,
          ...(priorCursor?.status ? { previousStatus: priorCursor.status } : {}),
          ...(nextCursor.cursorRunId ? { runId: nextCursor.cursorRunId } : {}),
          ...(nextCursor.commitSha ? { commitSha: String(nextCursor.commitSha).slice(0, 12) } : {}),
          ...(nextCursor.failureReason ? { failureReason: nextCursor.failureReason } : {}),
          changedFileCount: nextCursor.changedFiles?.length ?? 0,
        },
        detailLines: nextCursor.errorMessage?.trim()
          ? [`message=${nextCursor.errorMessage.trim().replace(/\s+/g, " ").slice(0, 240)}`]
          : [],
        nowIso: now,
      }),
    );
  }

  const priorGate = parseImplementationAutoQualityGateV1(input.prior.implementationAutoQualityGateV1);
  const nextGate = parseImplementationAutoQualityGateV1(input.next.implementationAutoQualityGateV1);
  if (
    nextGate &&
    (!priorGate ||
      priorGate.taskId !== nextGate.taskId ||
      priorGate.status !== nextGate.status ||
      priorGate.sourceCommitSha !== nextGate.sourceCommitSha ||
      priorGate.failureReason !== nextGate.failureReason)
  ) {
    pushIfChanged(
      entries,
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_auto_quality_gate_state_changed",
        orchestrationTraceGroup: "implementation_orchestration",
        routingDecision: nextGate.taskId,
        fields: {
          projectId: nextGate.projectId,
          taskId: nextGate.taskId,
          status: nextGate.status,
          ...(priorGate?.status ? { previousStatus: priorGate.status } : {}),
          ...(nextGate.sourceCommitSha
            ? { sourceCommitSha: nextGate.sourceCommitSha.slice(0, 12) }
            : {}),
          ...(nextGate.failureReason ? { reason: nextGate.failureReason } : {}),
        },
        nowIso: now,
      }),
    );
  }

  const priorWip = readCodeAgentWipSnapshot(input.prior.codeAgentWipExecutionV1);
  const nextWip = readCodeAgentWipSnapshot(input.next.codeAgentWipExecutionV1);
  if (
    nextWip &&
    (!priorWip ||
      priorWip.status !== nextWip.status ||
      priorWip.selectedTaskId !== nextWip.selectedTaskId ||
      priorWip.bridgeExecutionStatus !== nextWip.bridgeExecutionStatus)
  ) {
    pushIfChanged(
      entries,
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_code_agent_wip_state_changed",
        orchestrationTraceGroup: "implementation_orchestration",
        routingDecision: nextWip.selectedTaskId,
        fields: {
          projectId: nextWip.projectId,
          taskId: nextWip.selectedTaskId ?? "none",
          status: nextWip.status,
          bridgeExecutionStatus: nextWip.bridgeExecutionStatus ?? "none",
          ...(priorWip?.status ? { previousStatus: priorWip.status } : {}),
        },
        nowIso: now,
      }),
    );
  }

  const priorQuickRun = parseImplementationQuickRunV1(input.prior.implementationQuickRunV1);
  const nextQuickRun = parseImplementationQuickRunV1(input.next.implementationQuickRunV1);
  if (
    nextQuickRun &&
    (!priorQuickRun ||
      priorQuickRun.status !== nextQuickRun.status ||
      priorQuickRun.currentTaskId !== nextQuickRun.currentTaskId)
  ) {
    pushIfChanged(
      entries,
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_quick_run_state_changed",
        orchestrationTraceGroup: "implementation_orchestration",
        routingDecision: nextQuickRun.currentTaskId,
        fields: {
          projectId: nextQuickRun.projectId,
          status: nextQuickRun.status,
          ...(priorQuickRun?.status ? { previousStatus: priorQuickRun.status } : {}),
          ...(nextQuickRun.currentTaskId ? { taskId: nextQuickRun.currentTaskId } : {}),
          ...(nextQuickRun.blockedReason ? { reason: nextQuickRun.blockedReason } : {}),
        },
        nowIso: now,
      }),
    );
  }

  const priorRun = readLatestStageActionRun(input.prior.implementationStageActionRunLogV1);
  const nextRun = readLatestStageActionRun(input.next.implementationStageActionRunLogV1);
  if (nextRun && (!priorRun || priorRun.runId !== nextRun.runId || priorRun.status !== nextRun.status)) {
    pushIfChanged(
      entries,
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_stage_action_run_recorded",
        orchestrationTraceGroup: "implementation_orchestration",
        routingDecision: nextRun.actionId,
        fields: {
          projectId: nextRun.projectId,
          runId: nextRun.runId,
          actionId: nextRun.actionId,
          status: nextRun.status,
          source: nextRun.source,
          ...(nextRun.message ? { message: nextRun.message.replace(/\s+/g, " ").slice(0, 240) } : {}),
        },
        nowIso: now,
      }),
    );
  }

  const priorExecFp = readTaskExecutionFingerprint(input.prior.implementationTaskExecutionStateV1);
  const nextExecFp = readTaskExecutionFingerprint(input.next.implementationTaskExecutionStateV1);
  if (nextExecFp && priorExecFp !== nextExecFp) {
    const nextState = input.next.implementationTaskExecutionStateV1;
    pushIfChanged(
      entries,
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_task_execution_state_changed",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: nextState?.projectId ?? "",
          total: nextState?.summary?.total ?? 0,
          done: nextState?.summary?.done ?? 0,
          failed: nextState?.summary?.failed ?? 0,
          inProgress: nextState?.summary?.inProgress ?? 0,
          queued: nextState?.summary?.queued ?? 0,
        },
        nowIso: now,
      }),
    );
  }

  return entries;
}

export function shouldAppendAutoImplementationExecutionLogEntries(
  patch: PrototypeExecutionOrchestrationPersistInput,
): boolean {
  return patch.promptTimeline === undefined;
}

export function mergeImplementationExecutionLogTimeline(input: {
  readonly prior: RequirementsStateJson;
  readonly next: RequirementsStateJson;
  readonly patch: PrototypeExecutionOrchestrationPersistInput;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry[] {
  let timeline = sanitizeTimeline(input.next.promptTimeline ?? input.prior.promptTimeline);
  if (input.patch.promptTimeline !== undefined) {
    timeline = mergeTimelinePreservingExecutionLogs(
      sanitizeTimeline(input.prior.promptTimeline),
      sanitizeTimeline(input.patch.promptTimeline),
    );
  }
  if (shouldAppendAutoImplementationExecutionLogEntries(input.patch)) {
    const autoEntries = buildImplementationOrchestrationChangeTimelineEntries({
      prior: input.prior,
      next: input.next,
      nowIso: input.nowIso,
    });
    timeline = appendPromptTimelineEntriesOnce(timeline, autoEntries);
  }
  return timeline;
}

function sanitizeTimeline(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): RequirementsPromptTimelineEntry[] {
  return [...(timeline ?? [])];
}

function mergeTimelinePreservingExecutionLogs(
  prior: readonly RequirementsPromptTimelineEntry[],
  next: readonly RequirementsPromptTimelineEntry[],
): RequirementsPromptTimelineEntry[] {
  const priorLogs = pickPersistentExecutionLogTimelineEntries(prior);
  const nextTimeline = sanitizeTimeline(next);
  if (!priorLogs.length) return nextTimeline;

  const nextFingerprints = new Set(
    pickPersistentExecutionLogTimelineEntries(nextTimeline).map((entry) =>
      buildPromptTimelineEntryFingerprint(entry),
    ),
  );
  const missingLogs = priorLogs.filter(
    (entry) => !nextFingerprints.has(buildPromptTimelineEntryFingerprint(entry)),
  );
  if (!missingLogs.length) return nextTimeline;

  return [...missingLogs, ...nextTimeline].sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt)),
  );
}

export function buildImplementationEntrySnapshotTimelineEntry(input: {
  readonly projectId: string;
  readonly state: RequirementsStateJson;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry | null {
  const pid = input.projectId.trim();
  if (!pid) return null;
  const entryState = deriveImplementationEntryState({
    implementationSeedV1: input.state.implementationSeedV1,
    implementationTaskPlanV1: input.state.implementationTaskPlanV1,
    implementationCodeTaskPlanV1: input.state.implementationCodeTaskPlanV1,
    implementationTaskListV1: input.state.implementationTaskListV1,
    cursorWorkItemsV1: input.state.cursorWorkItemsV1,
    promptTimeline: input.state.promptTimeline,
    orchestration: input.state.singleChatOrchestrationV1,
  });
  const now = input.nowIso ?? new Date().toISOString();
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_entry_state_snapshot",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: pid,
      entryState: entryState.status,
      primaryAction: entryState.primaryAction,
      hasImplementationTaskList: entryState.hasImplementationTaskList,
      hasCursorWorkItems: entryState.hasCursorWorkItems,
      taskCount: entryState.taskCount,
      developerTaskCount: entryState.developerTaskCount,
    },
    nowIso: now,
  });
}
