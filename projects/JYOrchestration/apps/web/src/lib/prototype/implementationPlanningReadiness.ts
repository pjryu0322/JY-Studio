import {
  buildImplementationCodeTaskPlanFromTaskList,
  type ImplementationCodeTaskPlanV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import {
  buildCursorWorkItemsFromImplementationCodeTaskPlan,
  type CursorWorkItem,
} from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { buildImplementationWorkItemsDraftCreatedTimelineEntry } from "@/lib/prototype/implementationWorkItemRefinement";
import {
  buildWorkItemPreflightTimelineEntry,
  runWorkItemPreflightBatch,
} from "@/lib/prototype/implementationWorkItemPreflight";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";

export const IMPLEMENTATION_WORK_ITEM_PREFLIGHT_SUMMARY_VERSION =
  "implementation_work_item_preflight_summary_v1" as const;

export type ImplementationWorkItemPreflightSummaryV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_WORK_ITEM_PREFLIGHT_SUMMARY_VERSION;
  readonly projectId: string;
  readonly checkedAt: string;
  readonly status: "passed" | "failed";
  readonly workItemCount: number;
  readonly failedWorkItemIds: readonly string[];
  readonly failedReasons: readonly string[];
}>;

export function parseImplementationWorkItemPreflightSummaryV1(
  raw: unknown,
): ImplementationWorkItemPreflightSummaryV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_WORK_ITEM_PREFLIGHT_SUMMARY_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  if (!projectId) return null;
  const status = o.status === "failed" ? "failed" : "passed";
  return {
    version: IMPLEMENTATION_WORK_ITEM_PREFLIGHT_SUMMARY_VERSION,
    projectId,
    checkedAt: String(o.checkedAt ?? new Date().toISOString()),
    status,
    workItemCount: Number(o.workItemCount ?? 0) || 0,
    failedWorkItemIds: Array.isArray(o.failedWorkItemIds)
      ? o.failedWorkItemIds.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [],
    failedReasons: Array.isArray(o.failedReasons)
      ? o.failedReasons.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [],
  };
}

function buildPlanningReadinessTimelineEntry(input: {
  readonly action: string;
  readonly projectId: string;
  readonly fields?: Readonly<Record<string, string | number | boolean | undefined | null>>;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: input.action,
    orchestrationTraceGroup: "implementation_planning_readiness",
    fields: {
      projectId: input.projectId,
      mode: "planning",
      ...(input.fields ?? {}),
    },
    nowIso: input.nowIso,
  });
}

export type ImplementationPlanningReadinessPatch = Readonly<{
  readonly implementationCodeTaskPlanV1: ImplementationCodeTaskPlanV1;
  readonly cursorWorkItemsV1: readonly CursorWorkItem[];
  readonly implementationWorkItemPreflightSummaryV1: ImplementationWorkItemPreflightSummaryV1;
  readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
  readonly syncMode: "created" | "synced";
}>;

export function buildImplementationPlanningReadinessPatch(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly allowedPathGlobs?: readonly string[];
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly nowIso?: string;
  readonly includeTaskListCreatedEvent?: boolean;
  readonly syncMode?: "created" | "synced";
}): ImplementationPlanningReadinessPatch {
  const now = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const codeTaskPlan = buildImplementationCodeTaskPlanFromTaskList({
    projectId: pid,
    taskList: input.taskList,
    projectArtifacts: input.projectArtifacts,
    envOk: input.envOk,
    designOk: input.designOk,
    nowIso: now,
  });
  const cursorWorkItems = buildCursorWorkItemsFromImplementationCodeTaskPlan({
    projectId: pid,
    codeTaskPlan,
    nowIso: now,
    originStage: "planning",
  });
  const preflight = runWorkItemPreflightBatch({
    workItems: cursorWorkItems,
    allowedPathGlobs: input.allowedPathGlobs,
  });
  const preflightSummary: ImplementationWorkItemPreflightSummaryV1 = {
    version: IMPLEMENTATION_WORK_ITEM_PREFLIGHT_SUMMARY_VERSION,
    projectId: pid,
    checkedAt: now,
    status: preflight.status,
    workItemCount: cursorWorkItems.length,
    failedWorkItemIds: [...preflight.failedWorkItemIds],
    failedReasons: preflight.results.flatMap((result) => result.failedReasons).slice(0, 20),
  };

  let promptTimeline = [...(input.priorTimeline ?? [])];
  if (input.includeTaskListCreatedEvent) {
    promptTimeline = appendPromptTimeline(
      promptTimeline,
      buildPlanningReadinessTimelineEntry({
        action: "implementation_task_list_created_from_seed",
        projectId: pid,
        fields: {
          taskCount: input.taskList.tasks.length,
          developerTasks: input.taskList.roleSummary.developer,
        },
        nowIso: now,
      }),
    );
  }
  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildPlanningReadinessTimelineEntry({
      action: "implementation_code_task_plan_created",
      projectId: pid,
      fields: {
        parentTaskCount: codeTaskPlan.parentTaskCount,
        codeTaskCount: codeTaskPlan.codeTaskCount,
      },
      nowIso: now,
    }),
  );
  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildImplementationWorkItemsDraftCreatedTimelineEntry({
      projectId: pid,
      taskCount: codeTaskPlan.parentTaskCount,
      workItemCount: cursorWorkItems.length,
      originStage: "planning",
      nowIso: now,
    }),
  );
  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildWorkItemPreflightTimelineEntry({
      projectId: pid,
      taskId: "planning",
      result: preflight,
      nowIso: now,
    }),
  );
  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildPlanningReadinessTimelineEntry({
      action: "implementation_work_items_preflight_checked",
      projectId: pid,
      fields: {
        status: preflight.status,
        workItemCount: cursorWorkItems.length,
        failedCount: preflight.failedWorkItemIds.length,
      },
      nowIso: now,
    }),
  );
  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildPlanningReadinessTimelineEntry({
      action: "implementation_ready_for_execution",
      projectId: pid,
      fields: {
        ok: preflight.status === "passed" && codeTaskPlan.readiness.ready,
        codeTaskCount: codeTaskPlan.codeTaskCount,
      },
      nowIso: now,
    }),
  );

  return {
    implementationCodeTaskPlanV1: codeTaskPlan,
    cursorWorkItemsV1: cursorWorkItems,
    implementationWorkItemPreflightSummaryV1: preflightSummary,
    promptTimeline,
    syncMode: input.syncMode ?? "created",
  };
}

export function buildImplementationWorkItemsFallbackExecutionTimelineEntry(input: {
  readonly projectId: string;
  readonly taskId?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildPlanningReadinessTimelineEntry({
    action: "implementation_work_items_fallback_generated_in_execution_stage",
    projectId: input.projectId,
    fields: {
      ...(input.taskId ? { taskId: input.taskId } : {}),
      mode: "implementation",
    },
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}

export function buildImplementationWorkItemsFallbackFromTaskListTimelineEntry(input: {
  readonly projectId: string;
  readonly taskId?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildPlanningReadinessTimelineEntry({
    action: "implementation_work_items_fallback_generated_from_task_list",
    projectId: input.projectId,
    fields: {
      ...(input.taskId ? { taskId: input.taskId } : {}),
      mode: "fallback",
      source: "implementation_task_list",
    },
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}

export function buildImplementationExecutionBlockedByPlanningPreflightTimelineEntry(input: {
  readonly projectId: string;
  readonly reason: ImplementationPlanningExecutionGateReason;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildPlanningReadinessTimelineEntry({
    action: "implementation_execution_blocked_by_planning_preflight",
    projectId: input.projectId,
    fields: {
      reason: input.reason,
      mode: "implementation",
    },
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}

export const IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE =
  "구현 준비 산출물 보완이 필요합니다." as const;

export type ImplementationPlanningExecutionGateReason =
  | "missing_code_task_plan"
  | "missing_work_items"
  | "preflight_failed";

export type ImplementationPlanningExecutionGateResult =
  | Readonly<{ readonly ok: true }>
  | Readonly<{
      readonly ok: false;
      readonly message: string;
      readonly reason: ImplementationPlanningExecutionGateReason;
    }>;

export function evaluateImplementationPlanningExecutionGate(input: {
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly preflightSummary?: ImplementationWorkItemPreflightSummaryV1 | null;
  readonly skipGate?: boolean;
}): ImplementationPlanningExecutionGateResult {
  if (input.skipGate) return { ok: true };
  if (!input.codeTaskPlan?.tasks?.length) {
    return {
      ok: false,
      message: IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE,
      reason: "missing_code_task_plan",
    };
  }
  if (!input.cursorWorkItems?.length) {
    return {
      ok: false,
      message: IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE,
      reason: "missing_work_items",
    };
  }
  if (input.preflightSummary?.status === "failed") {
    return {
      ok: false,
      message: IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE,
      reason: "preflight_failed",
    };
  }
  return { ok: true };
}
