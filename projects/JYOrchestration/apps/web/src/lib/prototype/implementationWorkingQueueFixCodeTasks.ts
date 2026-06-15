import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
  parseImplementationCodeTaskPlanV1,
  type ImplementationCodeTaskPlanV1,
  type ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import {
  CODE_TASK_PROMPT_CONTEXT_MAP_VERSION,
  CODE_TASK_PROMPT_CONTEXT_VERSION,
  parseCodeTaskPromptContextMapV1,
  type CodeTaskPromptContextMapV1,
  type CodeTaskPromptContextV1,
} from "@/lib/prototype/codeTaskPromptContext";
import { mergeCursorWorkItemsWithMissingCodeTaskPlanTasks } from "@/lib/prototype/implementationCursorWorkItems";
import { materializeSelectedCodeTaskRuns } from "@/lib/prototype/implementationRuntimeRunMaterialization";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseImplementationPreviewRegionCapturesFromState } from "@/lib/prototype/implementationWorkingQueuePreviewThumbnail";
import type { ImplementationWorkingQueueItem, ImplementationWorkingQueueV1 } from "@/lib/prototype/implementationWorkingQueueTypes";
import { COMMON_FORBIDDEN_PATHS } from "@/lib/prototype/implementationExecutionHints";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseImplementationExecutionBoardStateV1, updateBoardSelectedCodeTaskIds } from "@/lib/prototype/implementationExecutionBoardState";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseRequirementsStateJson, type RequirementsPromptTimelineEntry, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";

export const WORKING_QUEUE_FIX_CODE_TASK_SOURCE = "working_queue_fix" as const;

export function workingQueueFixCodeTaskId(queueItemId: string): string {
  const slug = queueItemId.trim().replace(/^iwq-/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
  return `fix-wq-${slug || "item"}`;
}

function resolveParentTaskId(state: RequirementsStateJson): string {
  const taskList = parseImplementationTaskListV1(state.implementationTaskListV1);
  const tasks = taskList?.tasks ?? [];
  for (let i = tasks.length - 1; i >= 0; i--) {
    const id = tasks[i]?.taskId?.trim();
    if (id) return id;
  }
  return "process-working-queue-fix";
}

function previewCaptureNote(
  item: ImplementationWorkingQueueItem,
  state: RequirementsStateJson,
): string | undefined {
  const regionId = item.regionCaptureId?.trim();
  if (!regionId) return undefined;
  const captures = parseImplementationPreviewRegionCapturesFromState(state);
  const capture = captures.find((c) => c.id === regionId);
  if (!capture) {
    return `Preview regionCaptureId=${regionId}`;
  }
  const hasImage = Boolean(capture.imageDataUrl || capture.imageUrl);
  return [
    `Preview URL: ${capture.previewUrl}`,
    `regionCaptureId: ${regionId}`,
    `captureId: ${capture.captureId}`,
    hasImage ? "Annotated capture image is attached in project state." : "",
    item.rect
      ? `region rect: x=${item.rect.x} y=${item.rect.y} w=${item.rect.width} h=${item.rect.height}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildFixCodeTaskFromWorkingQueueItem(input: {
  readonly item: ImplementationWorkingQueueItem;
  readonly parentTaskId: string;
  readonly projectId: string;
  readonly nowIso: string;
  readonly previewNote?: string;
}): ImplementationCodeTaskV1 {
  const codeTaskId = workingQueueFixCodeTaskId(input.item.id);
  const desired = input.item.desiredBehavior?.trim() || input.item.rawUserMessage.trim();
  const descriptionParts = [
    input.item.description.trim(),
    desired && desired !== input.item.description.trim() ? `Desired behavior: ${desired}` : "",
    input.item.targetUi ? `Target UI: ${input.item.targetUi}` : "",
    input.previewNote ? `Preview context:\n${input.previewNote}` : "",
    `workingQueueItemId: ${input.item.id}`,
    `source: ${WORKING_QUEUE_FIX_CODE_TASK_SOURCE}`,
  ].filter(Boolean);

  return {
    codeTaskId,
    parentTaskId: input.parentTaskId,
    title: input.item.title.slice(0, 120),
    description: descriptionParts.join("\n\n").slice(0, 4000),
    changeType: input.item.affectedArea === "style" ? "style" : input.item.affectedArea === "bug" ? "unknown" : "component",
    targetHints: [
      input.item.targetUi?.trim(),
      input.item.previewUrl?.trim(),
      `working-queue:${input.item.id}`,
    ].filter((x): x is string => Boolean(x?.trim())),
    dependencies: [],
    acceptanceCriteria: [
      "사용자가 승인한 보완요청을 반영한다.",
      "기존 기능과 레이아웃을 손상하지 않는다.",
      "변경 후 Preview에서 사용자가 확인할 수 있어야 한다.",
      "GitHub에 commit/push하여 head commit 또는 noCodeChange 증거를 남긴다.",
    ],
    verificationHints: [
      "Preview에서 승인한 보완요청이 반영되었는지 확인한다.",
      "회귀가 없는지 주요 화면을 확인한다.",
    ],
    forbiddenPaths: [...COMMON_FORBIDDEN_PATHS],
    priority: input.item.riskLevel === "high" ? "P0" : input.item.riskLevel === "medium" ? "P1" : "P2",
    status: "ready",
    blockers: [],
    refinementSource: "heuristic",
    llmRationale: `${WORKING_QUEUE_FIX_CODE_TASK_SOURCE}:${input.item.id}`,
  };
}

function buildPromptContextForFixTask(input: {
  readonly projectId: string;
  readonly task: ImplementationCodeTaskV1;
  readonly item: ImplementationWorkingQueueItem;
  readonly nowIso: string;
}): CodeTaskPromptContextV1 {
  const desired = input.item.desiredBehavior?.trim() || input.item.rawUserMessage.trim();
  return {
    version: CODE_TASK_PROMPT_CONTEXT_VERSION,
    projectId: input.projectId,
    codeTaskId: input.task.codeTaskId,
    parentTaskId: input.task.parentTaskId,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
    source: "heuristic_fallback",
    planningContext: { targetUsers: [] },
    flowContext: { relatedActors: [], relatedUserFlows: [], relatedServiceSteps: [] },
    featureContext: {
      relatedFeatures: [],
      relatedScreens: input.item.targetUi ? [input.item.targetUi] : [],
      relatedStates: [],
      inputs: [],
      outputs: [],
    },
    implementationContext: {
      intent: input.item.title,
      requirements: [input.item.description, desired].filter(Boolean),
      constraints: ["Do not break unrelated screens.", "Prefer minimal diff."],
      expectedBehavior: desired ? [desired] : [input.item.description],
      edgeCases: [],
    },
    verificationContext: {
      acceptanceCriteria: [...input.task.acceptanceCriteria],
      manualChecks: [...input.task.verificationHints],
      regressionChecks: ["Open Preview after change."],
    },
    quality: { ready: true, missing: [], warnings: [] },
  };
}

export type WorkingQueueApprovalPersistResult = Readonly<{
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly createdCodeTaskIds: readonly string[];
}>;

export function buildWorkingQueueApprovalOrchestrationPatch(input: {
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly queue: ImplementationWorkingQueueV1;
  readonly approvedItems: readonly ImplementationWorkingQueueItem[];
  readonly nowIso?: string;
}): WorkingQueueApprovalPersistResult {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const state = parseRequirementsStateJson(input.requirementsStateJson) ?? {};
  const parentTaskId = resolveParentTaskId(state);

  const existingPlan =
    parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1) ??
    ({
      version: IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
      projectId: pid,
      createdAt: nowIso,
      updatedAt: nowIso,
      source: "implementation_task_list",
      parentTaskCount: 0,
      codeTaskCount: 0,
      tasks: [],
      readiness: { ready: false, missing: [] },
    } satisfies ImplementationCodeTaskPlanV1);

  const existingTasks = [...existingPlan.tasks];
  const existingIds = new Set(existingTasks.map((t) => t.codeTaskId));
  const createdCodeTaskIds: string[] = [];
  const queueItems = input.queue.items.map((row) => {
    const approved = input.approvedItems.find((a) => a.id === row.id);
    if (!approved) return row;
    const codeTaskId = workingQueueFixCodeTaskId(row.id);
    if (!existingIds.has(codeTaskId)) {
      const previewNote = previewCaptureNote(row, state);
      const task = buildFixCodeTaskFromWorkingQueueItem({
        item: row,
        parentTaskId,
        projectId: pid,
        nowIso,
        previewNote,
      });
      existingTasks.push(task);
      existingIds.add(codeTaskId);
      createdCodeTaskIds.push(codeTaskId);
    }
    return {
      ...row,
      status: "approved" as const,
      updatedAt: nowIso,
      fixCodeTaskIds: [workingQueueFixCodeTaskId(row.id)],
    };
  });

  const nextPlan: ImplementationCodeTaskPlanV1 = {
    ...existingPlan,
    projectId: pid,
    updatedAt: nowIso,
    codeTaskCount: existingTasks.length,
    tasks: existingTasks,
  };

  const workItemMerge = mergeCursorWorkItemsWithMissingCodeTaskPlanTasks({
    projectId: pid,
    codeTaskPlan: nextPlan,
    existingWorkItems: state.cursorWorkItemsV1 ?? [],
    nowIso,
    originStage: "implementation",
  });

  const priorContextMap =
    parseCodeTaskPromptContextMapV1(state.codeTaskPromptContextMapV1) ??
    ({
      version: CODE_TASK_PROMPT_CONTEXT_MAP_VERSION,
      projectId: pid,
      createdAt: nowIso,
      updatedAt: nowIso,
      contexts: {},
    } satisfies CodeTaskPromptContextMapV1);

  const contexts: Record<string, CodeTaskPromptContextV1> = { ...priorContextMap.contexts };
  for (const item of input.approvedItems) {
    const codeTaskId = workingQueueFixCodeTaskId(item.id);
    const task = existingTasks.find((t) => t.codeTaskId === codeTaskId);
    if (!task) continue;
    contexts[codeTaskId] = buildPromptContextForFixTask({ projectId: pid, task, item, nowIso });
  }
  const nextContextMap: CodeTaskPromptContextMapV1 = {
    ...priorContextMap,
    projectId: pid,
    updatedAt: nowIso,
    contexts,
  };

  const priorRuns = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
  const materialized = materializeSelectedCodeTaskRuns({
    projectId: pid,
    selectedCodeTaskIds: createdCodeTaskIds,
    codeTaskPlan: nextPlan,
    taskList: parseImplementationTaskListV1(state.implementationTaskListV1),
    cursorWorkItems: workItemMerge.cursorWorkItems,
    existingRuns: priorRuns,
    nowIso,
  });

  const boardState = parseImplementationExecutionBoardStateV1(state.implementationExecutionBoardStateV1);
  const prevSelected = boardState?.selectedCodeTaskIds ?? [];
  const nextBoardState = updateBoardSelectedCodeTaskIds({
    projectId: pid,
    state: boardState,
    selectedCodeTaskIds: [...prevSelected, ...createdCodeTaskIds],
    nowIso,
  });

  let timeline: readonly RequirementsPromptTimelineEntry[] = state.promptTimeline ?? [];
  for (const item of input.approvedItems) {
    const codeTaskId = workingQueueFixCodeTaskId(item.id);
    timeline = appendPromptTimeline(
      timeline,
      buildImplementationExecutionLogTimelineEntry({
        action: "working_queue_item_approved",
        fields: { workingQueueItemId: item.id, codeTaskId },
        nowIso,
      }),
    );
    timeline = appendPromptTimeline(
      timeline,
      buildImplementationExecutionLogTimelineEntry({
        action: "working_queue_fix_codetask_created",
        fields: { workingQueueItemId: item.id, codeTaskId, source: WORKING_QUEUE_FIX_CODE_TASK_SOURCE },
        nowIso,
      }),
    );
  }
  if (createdCodeTaskIds.length) {
    timeline = appendPromptTimeline(
      timeline,
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_enqueued",
        fields: {
          source: "working_queue_approved",
          codeTaskIds: createdCodeTaskIds.join(","),
        },
        nowIso,
      }),
    );
  }

  const nextQueue: ImplementationWorkingQueueV1 = {
    ...input.queue,
    items: queueItems,
    updatedAt: nowIso,
  };

  return {
    createdCodeTaskIds,
    orchestrationPatch: {
      implementationWorkingQueueV1: nextQueue,
      implementationCodeTaskPlanV1: nextPlan,
      cursorWorkItemsV1: workItemMerge.cursorWorkItems,
      codeTaskPromptContextMapV1: nextContextMap,
      codeTaskExecutionRunsV1: materialized.runs,
      implementationExecutionBoardStateV1: nextBoardState,
      promptTimeline: [...timeline],
    },
  };
}
