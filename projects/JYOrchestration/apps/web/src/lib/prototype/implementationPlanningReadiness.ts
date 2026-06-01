import {
  buildImplementationCodeTaskPlanFromTaskList,
  type ImplementationCodeTaskPlanV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import {
  isLlmCodeTaskRefinementEnabled,
  resolveImplementationCodeTaskPlanForPlanningReadiness,
  type LlmCodeTaskRefinementCaller,
} from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
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
import { validateImplementationCodeTaskPlan } from "@/lib/prototype/implementationCodeTaskPlanValidator";
import {
  evaluateImplementationCodeTaskQualityGate,
  type ImplementationCodeTaskQualityGateV1,
} from "@/lib/prototype/implementationCodeTaskQualityGate";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import {
  buildImplementationCodeTaskLlmRefinementDecisionTimelineEntry,
  resolveLlmRefinementDecisionFromServerSettings,
  type ProjectCodeTaskRefinementSettings,
} from "@/lib/prototype/resolveProjectCodeTaskRefinementSettingsShared";
import type { LlmCodeTaskRefinementProviderContext } from "@/lib/prototype/implementationCodeTaskPlanLlmProvider";
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
  readonly implementationCodeTaskQualityGateV1: ImplementationCodeTaskQualityGateV1;
  readonly cursorWorkItemsV1: readonly CursorWorkItem[];
  readonly implementationWorkItemPreflightSummaryV1: ImplementationWorkItemPreflightSummaryV1;
  readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
  readonly syncMode: "created" | "synced";
}>;

function buildPlanningReadinessPatchFromCodeTaskPlan(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly allowedPathGlobs?: readonly string[];
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly extraTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso: string;
  readonly includeTaskListCreatedEvent?: boolean;
  readonly syncMode?: "created" | "synced";
}): ImplementationPlanningReadinessPatch {
  const now = input.nowIso;
  const pid = input.projectId.trim();
  const qualityGate = evaluateImplementationCodeTaskQualityGate({
    projectId: pid,
    codeTaskPlan: input.codeTaskPlan,
    nowIso: now,
  });
  const cursorWorkItems = buildCursorWorkItemsFromImplementationCodeTaskPlan({
    projectId: pid,
    codeTaskPlan: input.codeTaskPlan,
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

  let promptTimeline = [...(input.priorTimeline ?? []), ...(input.extraTimeline ?? [])];
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
        parentTaskCount: input.codeTaskPlan.parentTaskCount,
        codeTaskCount: input.codeTaskPlan.codeTaskCount,
        refinementSource: input.codeTaskPlan.refinementSource ?? "heuristic",
        refinementStatus: input.codeTaskPlan.refinementStatus ?? "heuristic_only",
        validationStatus: input.codeTaskPlan.validationReport?.status ?? "unknown",
      },
      nowIso: now,
    }),
  );
  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildPlanningReadinessTimelineEntry({
      action: "implementation_code_task_quality_gate_checked",
      projectId: pid,
      fields: {
        status: qualityGate.status,
        issueCount: qualityGate.issueCount,
        errorCount: qualityGate.errorCount,
        warningCount: qualityGate.warningCount,
      },
      nowIso: now,
    }),
  );
  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildImplementationWorkItemsDraftCreatedTimelineEntry({
      projectId: pid,
      taskCount: input.codeTaskPlan.parentTaskCount,
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
  const executionGate = evaluateImplementationPlanningExecutionGate({
    codeTaskPlan: input.codeTaskPlan,
    cursorWorkItems,
    preflightSummary,
    codeTaskQualityGate: qualityGate,
  });
  const refinementStatus = input.codeTaskPlan.refinementStatus ?? "heuristic_only";
  const fallbackUsed =
    refinementStatus === "llm_parse_failed_fallback" ||
    refinementStatus === "llm_validation_failed_fallback" ||
    refinementStatus === "llm_validation_failed" ||
    refinementStatus === "llm_unavailable_fallback" ||
    refinementStatus === "llm_timeout_fallback";

  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildPlanningReadinessTimelineEntry({
      action: "implementation_ready_for_execution",
      projectId: pid,
      fields: {
        ok: executionGate.ok,
        codeTaskCount: input.codeTaskPlan.codeTaskCount,
        qualityStatus: qualityGate.status,
        validationStatus: input.codeTaskPlan.validationReport?.status ?? "unknown",
        preflightStatus: preflight.status,
        fallbackUsed,
        ...(executionGate.ok ? {} : { blockReason: executionGate.reason }),
      },
      nowIso: now,
    }),
  );

  return {
    implementationCodeTaskPlanV1: input.codeTaskPlan,
    implementationCodeTaskQualityGateV1: qualityGate,
    cursorWorkItemsV1: cursorWorkItems,
    implementationWorkItemPreflightSummaryV1: preflightSummary,
    promptTimeline,
    syncMode: input.syncMode ?? "created",
  };
}

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
  const heuristicPlan = buildImplementationCodeTaskPlanFromTaskList({
    projectId: pid,
    taskList: input.taskList,
    projectArtifacts: input.projectArtifacts,
    envOk: input.envOk,
    designOk: input.designOk,
    nowIso: now,
  });
  const validationReport = validateImplementationCodeTaskPlan({
    plan: heuristicPlan,
    taskList: input.taskList,
    nowIso: now,
  });
  const codeTaskPlan: ImplementationCodeTaskPlanV1 = {
    ...heuristicPlan,
    validationReport,
  };
  return buildPlanningReadinessPatchFromCodeTaskPlan({
    projectId: pid,
    taskList: input.taskList,
    codeTaskPlan,
    allowedPathGlobs: input.allowedPathGlobs,
    priorTimeline: input.priorTimeline,
    extraTimeline: [
      buildPlanningReadinessTimelineEntry({
        action: "implementation_code_task_plan_validated",
        projectId: pid,
        fields: {
          validationStatus: validationReport.status,
          heuristicTaskCount: heuristicPlan.tasks.length,
          source: "heuristic",
        },
        nowIso: now,
      }),
    ],
    nowIso: now,
    includeTaskListCreatedEvent: input.includeTaskListCreatedEvent,
    syncMode: input.syncMode,
  });
}

export async function buildImplementationPlanningReadinessPatchWithLlm(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly allowedPathGlobs?: readonly string[];
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly nowIso?: string;
  readonly includeTaskListCreatedEvent?: boolean;
  readonly syncMode?: "created" | "synced";
  readonly llmCaller?: LlmCodeTaskRefinementCaller;
  readonly forceLlm?: boolean;
  /** Injected by server API routes. Client paths must not prisma-resolve settings. */
  readonly refinementSettings?: ProjectCodeTaskRefinementSettings | null;
  readonly providerContext?: LlmCodeTaskRefinementProviderContext | null;
}): Promise<ImplementationPlanningReadinessPatch> {
  const now = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const resolvedDecision = resolveLlmRefinementDecisionFromServerSettings({
    refinementSettings: input.refinementSettings,
    forceLlm: input.forceLlm,
  });
  const refinementSettings = resolvedDecision.settings;
  const enableLlmCodeTaskRefinement = refinementSettings.enableLlmCodeTaskRefinement;
  const decisionTimelineEntry = buildImplementationCodeTaskLlmRefinementDecisionTimelineEntry({
    projectId: pid,
    settings: refinementSettings,
    decision: resolvedDecision.decision,
    skipReason: resolvedDecision.skipReason,
    useLlm: resolvedDecision.useLlm,
    nowIso: now,
  });
  const priorTimelineWithDecision = appendPromptTimeline(input.priorTimeline ?? [], decisionTimelineEntry);
  const providerContext = input.providerContext ?? null;
  const heuristicPlan = buildImplementationCodeTaskPlanFromTaskList({
    projectId: pid,
    taskList: input.taskList,
    projectArtifacts: input.projectArtifacts,
    envOk: input.envOk,
    designOk: input.designOk,
    nowIso: now,
  });
  const useLlm =
    input.forceLlm === true
      ? true
      : resolvedDecision.useLlm ||
        (input.refinementSettings == null &&
          !enableLlmCodeTaskRefinement &&
          isLlmCodeTaskRefinementEnabled());
  const resolved = await resolveImplementationCodeTaskPlanForPlanningReadiness({
    projectId: pid,
    taskList: input.taskList,
    heuristicPlan,
    projectArtifacts: input.projectArtifacts,
    implementationSeedV1: input.implementationSeedV1,
    envOk: input.envOk,
    designOk: input.designOk,
    nowIso: now,
    useLlmRefinement: useLlm,
    llmCaller: input.llmCaller,
    providerContext,
    enableLlmCodeTaskRefinement,
    hasOpenaiPlannerApiKey: refinementSettings.hasOpenaiPlannerApiKey,
    skipReason: resolvedDecision.skipReason,
  });
  return buildPlanningReadinessPatchFromCodeTaskPlan({
    projectId: pid,
    taskList: input.taskList,
    codeTaskPlan: resolved.plan,
    allowedPathGlobs: input.allowedPathGlobs,
    priorTimeline: priorTimelineWithDecision,
    extraTimeline:
      !useLlm && enableLlmCodeTaskRefinement === false && input.forceLlm !== true
        ? [
            ...resolved.timelineEntries,
            buildPlanningReadinessTimelineEntry({
              action: "implementation_code_task_llm_refinement_skipped",
              projectId: pid,
              fields: {
                reason: resolvedDecision.skipReason ?? "disabled_by_project_setting",
                enableLlmCodeTaskRefinement: false,
                hasOpenaiPlannerApiKey: refinementSettings.hasOpenaiPlannerApiKey,
                useLlm: false,
                skipReason: resolvedDecision.skipReason ?? "disabled_by_project_setting",
              },
              nowIso: now,
            }),
          ]
        : resolved.timelineEntries,
    nowIso: now,
    includeTaskListCreatedEvent: input.includeTaskListCreatedEvent,
    syncMode: input.syncMode,
  });
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

export function buildImplementationExecutionBlockedByCodeTaskValidationTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildPlanningReadinessTimelineEntry({
    action: "implementation_execution_blocked_by_code_task_validation",
    projectId: input.projectId,
    fields: { mode: "implementation" },
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}

export function buildImplementationExecutionBlockedByMissingCodeTaskValidationTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildPlanningReadinessTimelineEntry({
    action: "implementation_execution_blocked_by_missing_code_task_validation",
    projectId: input.projectId,
    fields: { mode: "implementation" },
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}

export function buildImplementationExecutionBlockedByPlanningGateTimelineEntry(input: {
  readonly projectId: string;
  readonly reason: ImplementationPlanningExecutionGateReason;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  if (input.reason === "missing_code_task_validation") {
    return buildImplementationExecutionBlockedByMissingCodeTaskValidationTimelineEntry({
      projectId: input.projectId,
      nowIso: input.nowIso,
    });
  }
  if (input.reason === "code_task_validation_failed") {
    return buildImplementationExecutionBlockedByCodeTaskValidationTimelineEntry({
      projectId: input.projectId,
      nowIso: input.nowIso,
    });
  }
  if (input.reason === "code_task_quality_failed") {
    return buildImplementationExecutionBlockedByCodeTaskQualityTimelineEntry({
      projectId: input.projectId,
      nowIso: input.nowIso,
    });
  }
  if (input.reason === "missing_code_task_quality") {
    return buildImplementationExecutionBlockedByMissingCodeTaskQualityTimelineEntry({
      projectId: input.projectId,
      nowIso: input.nowIso,
    });
  }
  return buildImplementationExecutionBlockedByPlanningPreflightTimelineEntry({
    projectId: input.projectId,
    reason: input.reason,
    nowIso: input.nowIso,
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

export function buildImplementationExecutionBlockedByCodeTaskQualityTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildPlanningReadinessTimelineEntry({
    action: "implementation_execution_blocked_by_code_task_quality",
    projectId: input.projectId,
    fields: { mode: "implementation" },
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}

export function buildImplementationExecutionBlockedByMissingCodeTaskQualityTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildPlanningReadinessTimelineEntry({
    action: "implementation_execution_blocked_by_missing_code_task_quality",
    projectId: input.projectId,
    fields: { mode: "implementation" },
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}

export const IMPLEMENTATION_PLANNING_CODE_TASK_QUALITY_FAILED_MESSAGE =
  "구현 CodeTask 품질 보완이 필요합니다." as const;

export const IMPLEMENTATION_PLANNING_MISSING_CODE_TASK_QUALITY_MESSAGE =
  "구현 CodeTask 품질 점검 결과가 없습니다. 구현 준비 산출물을 동기화해 주세요." as const;

export const IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE =
  "구현 준비 산출물 보완이 필요습니다." as const;

export const IMPLEMENTATION_PLANNING_MISSING_VALIDATION_MESSAGE =
  "구현 준비 검증 결과가 없습니다. 구현 준비 산출물을 동기화해 주세요." as const;

export type ImplementationPlanningExecutionGateReason =
  | "missing_code_task_plan"
  | "missing_work_items"
  | "preflight_failed"
  | "code_task_validation_failed"
  | "missing_code_task_validation"
  | "code_task_quality_failed"
  | "missing_code_task_quality";

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
  readonly codeTaskQualityGate?: ImplementationCodeTaskQualityGateV1 | null;
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
  const validationStatus = input.codeTaskPlan?.validationReport?.status;
  if (!validationStatus) {
    return {
      ok: false,
      message: IMPLEMENTATION_PLANNING_MISSING_VALIDATION_MESSAGE,
      reason: "missing_code_task_validation",
    };
  }
  if (validationStatus === "failed") {
    return {
      ok: false,
      message: IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE,
      reason: "code_task_validation_failed",
    };
  }
  if (!input.codeTaskQualityGate) {
    return {
      ok: false,
      message: IMPLEMENTATION_PLANNING_MISSING_CODE_TASK_QUALITY_MESSAGE,
      reason: "missing_code_task_quality",
    };
  }
  if (input.codeTaskQualityGate.status === "failed") {
    return {
      ok: false,
      message: IMPLEMENTATION_PLANNING_CODE_TASK_QUALITY_FAILED_MESSAGE,
      reason: "code_task_quality_failed",
    };
  }
  return { ok: true };
}
