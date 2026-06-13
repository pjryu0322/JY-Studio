import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiFromEnv, resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import {
  classifyLlmProviderFallbackReason,
  CODE_TASK_LLM_JSON_SYSTEM_INSTRUCTIONS,
  hashLlmResponsePreview,
  logLlmCodeTaskJsonDevPreview,
  formatLlmParseAttemptsForTimeline,
  normalizeLlmCodeTaskPlanRoot,
  parseLlmJsonObjectWithRecovery,
  safeLlmResponsePreviewStart,
  type LlmJsonParseAttemptTrace,
} from "@/lib/prototype/llmJsonParseRecovery";
import {
  attachCodeTaskPlanRefinementMeta,
  buildLlmPromptFingerprint,
  buildLlmResultFingerprint,
  buildSourceSeedFingerprint,
  buildSourceTaskListFingerprint,
  type ImplementationCodeTaskPlanLlmUsage,
} from "@/lib/prototype/implementationCodeTaskPlanFingerprint";
import { formatCodeTaskLlmRefinementSummaryFromPlan } from "@/lib/prototype/implementationReadinessSummary";
import {
  COMMON_FORBIDDEN_PATHS,
} from "@/lib/prototype/implementationExecutionHints";
import {
  IMPLEMENTATION_CODE_TASK_CHANGE_TYPES,
  IMPLEMENTATION_CODE_TASK_CONSOLIDATION_LLM_GUIDELINES,
  type ImplementationCodeTaskChangeType,
  type ImplementationCodeTaskPlanV1,
  type ImplementationCodeTaskPlanLlmRefinementSummaryV1,
  type ImplementationCodeTaskPlanRefinementSource,
  type ImplementationCodeTaskPlanRefinementStatus,
  type ImplementationCodeTaskPlanValidationReportV1,
  type ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { runWithConcurrency } from "@/lib/async/runWithConcurrency";
import { resolveCodeTaskLlmBatchConcurrency } from "@/lib/prototype/codeTaskLlmBatchConcurrency";
import {
  buildCodeTaskLlmRefinementBatchPlan,
  buildCodeTaskLlmRefinementBatchUserPrompt,
  buildMergedPlanDraft,
  mergeBatchedCodeTaskRefinementResults,
  type CodeTaskLlmRefinementBatch,
} from "@/lib/prototype/implementationCodeTaskPlanLlmBatchRefinement";
import { validateImplementationCodeTaskPlan } from "@/lib/prototype/implementationCodeTaskPlanValidator";
import { resolveCodeTaskPlanAggregateCounts } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { LlmCodeTaskRefinementProviderContext } from "@/lib/prototype/implementationCodeTaskPlanLlmProvider";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type LlmCodeTaskRefinementCallerResult =
  | Readonly<{
      readonly ok: true;
      readonly text: string;
      readonly usage?: ImplementationCodeTaskPlanLlmUsage | null;
    }>
  | Readonly<{ readonly ok: false; readonly message: string }>;

export type LlmCodeTaskRefinementCaller = (
  prompt: string,
) => Promise<LlmCodeTaskRefinementCallerResult>;

export function isLlmCodeTaskRefinementEnabled(): boolean {
  return String(process.env.ENABLE_LLM_CODE_TASK_REFINEMENT ?? "").trim().toLowerCase() === "true";
}

/** User-facing CodeTask LLM refinement summary for Quick Design confirm chat. */
export function formatCodeTaskLlmRefinementUserSummaryLines(
  plan: ImplementationCodeTaskPlanV1 | null | undefined,
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): readonly string[] {
  return formatCodeTaskLlmRefinementSummaryFromPlan({ codeTaskPlan: plan, timelineEntries });
}

function buildPlanningLlmTimelineEntry(input: {
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

function summarizeSeed(seed: ImplementationSeedV1 | null | undefined): string {
  if (!seed) return "(none)";
  return [
    `lifecycle=${seed.lifecycleStatus}`,
    `processItems=${seed.processImplementationItems.length}`,
    `screenItems=${seed.screenImplementationItems.length}`,
    `entities=${seed.dataModelSeed.entities.join(",") || "(none)"}`,
  ].join("; ");
}

function summarizeArtifacts(artifacts: readonly ProjectArtifact[] | undefined): string {
  return (artifacts ?? [])
    .slice(0, 8)
    .map((artifact) => `${artifact.type}:${artifact.title}`)
    .join("\n");
}

export function buildCodeTaskLlmRefinementUserPrompt(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly heuristicPlan: ImplementationCodeTaskPlanV1;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
}): string {
  const developerTasks = (input.taskList.tasks ?? []).filter((task) => task.ownerRole === "developer");
  return [
    "[implementation code task refinement]",
    `projectId=${input.projectId}`,
    "",
    "Developer tasks:",
    JSON.stringify(
      developerTasks.map((task) => ({
        taskId: task.taskId,
        title: task.title,
        taskType: task.taskType,
        description: task.description,
        dependencies: task.dependencies ?? [],
        acceptanceCriteria: task.acceptanceCriteria ?? [],
      })),
      null,
      2,
    ),
    "",
    "Heuristic CodeTaskPlan draft:",
    JSON.stringify(input.heuristicPlan.tasks.slice(0, 40), null, 2),
    "",
    "Implementation seed summary:",
    summarizeSeed(input.implementationSeedV1),
    "",
    "Project artifacts:",
    summarizeArtifacts(input.projectArtifacts) || "(none)",
    "",
    "Tech stack hints:",
    "- Next.js / TypeScript / pnpm monorepo",
    "- Scope: projects/JYOrchestration only",
    "",
    ...IMPLEMENTATION_CODE_TASK_CONSOLIDATION_LLM_GUIDELINES,
    "",
    "Forbidden:",
    "- Do not modify Stage1/ENV_TEST/GitHub/Cursor pipeline",
    "- Do not reference tasks outside developer task list as parentTaskId",
    "- Do not emit empty acceptanceCriteria or verificationHints",
    "",
    "Output requirements:",
    "- Output JSON only.",
    "- Do not use markdown.",
    "- Do not wrap the JSON in ```json fences.",
    "- Do not include explanation before or after JSON.",
    "- Every task must include codeTaskId, parentTaskId, and required fields.",
    "",
    "Return JSON only:",
    `{
  "tasks": [
    {
      "codeTaskId": "CODE-DEV-SCREEN-001-001",
      "parentTaskId": "DEV-SCREEN-001",
      "title": "...",
      "description": "...",
      "changeType": "component",
      "targetHints": ["components", "screen"],
      "candidateFiles": [],
      "candidateFileHints": ["dir:apps/web/src/components"],
      "parentTaskDependencies": [],
      "codeTaskDependencies": [],
      "acceptanceCriteria": ["..."],
      "verificationHints": ["..."],
      "forbiddenPaths": ["package.json"],
      "priority": "P1",
      "status": "ready",
      "llmRationale": "..."
    }
  ]
}`,
  ].join("\n");
}

function parseChangeType(raw: unknown): ImplementationCodeTaskChangeType {
  const value = String(raw ?? "unknown").trim() as ImplementationCodeTaskChangeType;
  return IMPLEMENTATION_CODE_TASK_CHANGE_TYPES.includes(value) ? value : "unknown";
}

function appendLlmParseAttemptTimelineEntries(input: {
  readonly projectId: string;
  readonly nowIso: string;
  readonly attempts: readonly LlmJsonParseAttemptTrace[];
  readonly batchId?: string;
}): RequirementsPromptTimelineEntry[] {
  return input.attempts.map((attempt) =>
    buildPlanningLlmTimelineEntry({
      action: "implementation_code_task_llm_parse_attempt",
      projectId: input.projectId,
      fields: {
        ...(input.batchId ? { batchId: input.batchId } : {}),
        strategy: attempt.strategy,
        outcome: attempt.outcome,
        ...(attempt.detail ? { detail: attempt.detail.slice(0, 120) } : {}),
      },
      nowIso: input.nowIso,
    }),
  );
}

function parseLlmCodeTasksFromJson(raw: unknown): Readonly<{
  readonly tasks: readonly ImplementationCodeTaskV1[];
  readonly normalizeSource: string;
}> | null {
  const normalized = normalizeLlmCodeTaskPlanRoot(raw);
  if (!normalized) return null;
  const tasksRaw = normalized.value.tasks;
  if (!tasksRaw.length) return null;

  const tasks: ImplementationCodeTaskV1[] = [];
  for (const item of tasksRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const codeTaskId = String(row.codeTaskId ?? "").trim();
    const parentTaskId = String(row.parentTaskId ?? "").trim();
    if (!codeTaskId || !parentTaskId) continue;

    const parentTaskDependencies = Array.isArray(row.parentTaskDependencies)
      ? row.parentTaskDependencies.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [];
    const codeTaskDependencies = Array.isArray(row.codeTaskDependencies)
      ? row.codeTaskDependencies.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [];
    const dependencies = [...parentTaskDependencies, ...codeTaskDependencies];
    const forbiddenPaths = Array.isArray(row.forbiddenPaths)
      ? row.forbiddenPaths.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [...COMMON_FORBIDDEN_PATHS];

    tasks.push({
      codeTaskId,
      parentTaskId,
      title: String(row.title ?? codeTaskId),
      description: String(row.description ?? row.title ?? codeTaskId),
      changeType: parseChangeType(row.changeType),
      targetHints: Array.isArray(row.targetHints)
        ? row.targetHints.map((v) => String(v ?? "").trim()).filter(Boolean)
        : ["scope"],
      ...(Array.isArray(row.candidateFiles)
        ? { candidateFiles: row.candidateFiles.map((v) => String(v ?? "").trim()).filter(Boolean) }
        : {}),
      ...(Array.isArray(row.candidateFileHints)
        ? {
            candidateFileHints: row.candidateFileHints
              .map((v) => String(v ?? "").trim())
              .filter(Boolean),
          }
        : {}),
      dependencies,
      parentTaskDependencies,
      codeTaskDependencies,
      acceptanceCriteria: Array.isArray(row.acceptanceCriteria)
        ? row.acceptanceCriteria.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [`${row.title ?? codeTaskId} 완료`],
      verificationHints: Array.isArray(row.verificationHints)
        ? row.verificationHints.map((v) => String(v ?? "").trim()).filter(Boolean)
        : ["pnpm test"],
      forbiddenPaths: forbiddenPaths.length ? forbiddenPaths : [...COMMON_FORBIDDEN_PATHS],
      priority: row.priority === "P0" || row.priority === "P2" ? row.priority : "P1",
      status:
        row.status === "ready" ||
        row.status === "blocked" ||
        row.status === "draft" ||
        row.status === "running" ||
        row.status === "done" ||
        row.status === "failed"
          ? row.status
          : "ready",
      blockers: [],
      refinementSource: "llm",
      ...(typeof row.llmRationale === "string" && row.llmRationale.trim()
        ? { llmRationale: row.llmRationale.trim().slice(0, 500) }
        : {}),
    });
  }
  return tasks.length
    ? { tasks, normalizeSource: normalized.normalizeSource }
    : null;
}

function mergeLlmUsage(
  accumulated: ImplementationCodeTaskPlanLlmUsage | null,
  next: ImplementationCodeTaskPlanLlmUsage | null | undefined,
): ImplementationCodeTaskPlanLlmUsage | null {
  if (!next) return accumulated;
  if (!accumulated) return next;
  return {
    model: next.model ?? accumulated.model,
    promptTokens: (accumulated.promptTokens ?? 0) + (next.promptTokens ?? 0) || undefined,
    completionTokens: (accumulated.completionTokens ?? 0) + (next.completionTokens ?? 0) || undefined,
    totalTokens: (accumulated.totalTokens ?? 0) + (next.totalTokens ?? 0) || undefined,
  };
}

function validateBatchLlmTasks(input: {
  readonly basePlan: ImplementationCodeTaskPlanV1;
  readonly batch: CodeTaskLlmRefinementBatch;
  readonly llmTasks: readonly ImplementationCodeTaskV1[];
  readonly taskList: ImplementationTaskListV1;
  readonly nowIso: string;
}): ImplementationCodeTaskPlanValidationReportV1 {
  const expectedIds = new Set(input.batch.codeTaskIds);
  const llmById = new Map(input.llmTasks.map((task) => [task.codeTaskId, task]));
  for (const codeTaskId of expectedIds) {
    if (!llmById.has(codeTaskId)) {
      return {
        status: "failed",
        checkedAt: input.nowIso,
        errors: [`batch ${input.batch.batchId}: missing refined task ${codeTaskId}`],
        warnings: [],
      };
    }
  }

  const mergedTasks = input.basePlan.tasks.map((task) =>
    expectedIds.has(task.codeTaskId) ? (llmById.get(task.codeTaskId) ?? task) : task,
  );
  return validateImplementationCodeTaskPlan({
    plan: buildMergedPlanDraft({ basePlan: input.basePlan, mergedTasks }),
    taskList: input.taskList,
    nowIso: input.nowIso,
  });
}

type CodeTaskLlmBatchFailureReason =
  | "llm_unavailable_fallback"
  | "llm_timeout_fallback"
  | "llm_parse_failed_fallback"
  | "llm_shape_invalid_fallback"
  | "llm_validation_failed_fallback";

function buildPlanFromTasks(input: {
  readonly basePlan: ImplementationCodeTaskPlanV1;
  readonly tasks: readonly ImplementationCodeTaskV1[];
  readonly refinementSource: ImplementationCodeTaskPlanRefinementSource;
  readonly refinementStatus: ImplementationCodeTaskPlanRefinementStatus;
  readonly validationReport: ImplementationCodeTaskPlanValidationReportV1;
  readonly heuristicTaskCount: number;
  readonly nowIso: string;
  readonly llmRefinedAt?: string;
  readonly sourceTaskListFingerprint?: string;
  readonly sourceSeedFingerprint?: string;
  readonly llmPromptFingerprint?: string;
  readonly llmResultFingerprint?: string;
  readonly refinementRequestedAt?: string;
  readonly refinementCompletedAt?: string;
  readonly llmUsage?: ImplementationCodeTaskPlanLlmUsage | null;
  readonly llmRefinementSummary?: ImplementationCodeTaskPlanLlmRefinementSummaryV1;
}): ImplementationCodeTaskPlanV1 {
  const missing = [...(input.basePlan.readiness.missing ?? [])];
  if (input.tasks.some((task) => task.status === "blocked")) missing.push("blocked CodeTask 존재");
  if (input.tasks.some((task) => task.status === "draft")) missing.push("draft CodeTask 존재");
  if (input.validationReport.status === "failed") missing.push("CodeTaskPlan validation failed");

  const planCounts = resolveCodeTaskPlanAggregateCounts(input.tasks);
  const plan: ImplementationCodeTaskPlanV1 = {
    ...input.basePlan,
    updatedAt: input.nowIso,
    tasks: input.tasks,
    codeTaskCount: planCounts.executableCodeTaskCount,
    parentTaskCount: input.basePlan.parentTaskCount,
    readiness: {
      ready:
        input.validationReport.status === "passed" &&
        input.tasks.length > 0 &&
        input.tasks.every((task) => task.status === "ready"),
      missing: [...new Set(missing)],
    },
    refinementSource: input.refinementSource,
    refinementStatus: input.refinementStatus,
    validationReport: input.validationReport,
    heuristicTaskCount: input.heuristicTaskCount,
    refinedTaskCount: input.tasks.length,
    ...(input.llmRefinedAt ? { llmRefinedAt: input.llmRefinedAt } : {}),
    ...(input.llmRefinementSummary ? { llmRefinementSummary: input.llmRefinementSummary } : {}),
  };

  return attachCodeTaskPlanRefinementMeta({
    plan,
    sourceTaskListFingerprint: input.sourceTaskListFingerprint,
    sourceSeedFingerprint: input.sourceSeedFingerprint,
    llmPromptFingerprint: input.llmPromptFingerprint,
    llmResultFingerprint: input.llmResultFingerprint,
    refinementRequestedAt: input.refinementRequestedAt,
    refinementCompletedAt: input.refinementCompletedAt,
    llmUsage: input.llmUsage,
  });
}

async function defaultLlmCaller(
  prompt: string,
  providerContext?: LlmCodeTaskRefinementProviderContext | null,
): Promise<LlmCodeTaskRefinementCallerResult> {
  const projectKey = String(providerContext?.apiKey ?? "").trim();
  const env = resolveOpenAiFromEnv();
  const apiKey = projectKey || (env.ok ? env.apiKey : "");
  const model = String(providerContext?.model ?? (env.ok ? env.model : resolveOpenAiModelFromEnv()));
  if (!apiKey) {
    return {
      ok: false,
      message: projectKey
        ? "OpenAI API key가 유효하지 않습니다."
        : env.ok
          ? env.message
          : "OpenAI Planner API key가 설정되어 있지 않습니다.",
    };
  }
  const result = await postOpenAiChatCompletion({
    apiKey,
    model,
    temperature: 0.2,
    responseFormatJsonObject: true,
    maxTokens: 2048,
    returnUsage: true,
    messages: [
      {
        role: "system",
        content: CODE_TASK_LLM_JSON_SYSTEM_INSTRUCTIONS,
      },
      { role: "user", content: prompt },
    ],
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  const usage: ImplementationCodeTaskPlanLlmUsage | null = result.usage
    ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        model,
      }
    : { model };
  return { ok: true, text: result.text, usage };
}

type CodeTaskLlmBatchProcessResult = Readonly<{
  readonly source: "llm" | "heuristic_fallback";
  readonly tasks: readonly ImplementationCodeTaskV1[];
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly promptFingerprint: string;
  readonly resultFingerprint?: string;
  readonly usage?: ImplementationCodeTaskPlanLlmUsage | null;
  readonly failureReason?: CodeTaskLlmBatchFailureReason;
}>;

async function processCodeTaskLlmBatch(input: {
  readonly projectId: string;
  readonly batch: CodeTaskLlmRefinementBatch;
  readonly heuristicPlan: ImplementationCodeTaskPlanV1;
  readonly taskList: ImplementationTaskListV1;
  readonly projectArtifactsSummary: string;
  readonly implementationSeedSummary: string;
  readonly caller: LlmCodeTaskRefinementCaller;
  readonly providerSource: string;
  readonly modelName: string;
  readonly nowIso: string;
}): Promise<CodeTaskLlmBatchProcessResult> {
  const pid = input.projectId;
  const batchPrompt = buildCodeTaskLlmRefinementBatchUserPrompt({
    projectId: pid,
    batch: input.batch,
    taskList: input.taskList,
    projectArtifactsSummary: input.projectArtifactsSummary,
    implementationSeedSummary: input.implementationSeedSummary,
  });
  const promptFingerprint = buildLlmPromptFingerprint(batchPrompt);
  const batchRequestedEntry = buildPlanningLlmTimelineEntry({
    action: "implementation_code_task_llm_batch_requested",
    projectId: pid,
    fields: {
      batchId: input.batch.batchId,
      batchIndex: input.batch.batchIndex,
      codeTaskCount: input.batch.codeTaskIds.length,
      parentTaskIds: input.batch.parentTaskIds.join(","),
      llmPromptFingerprint: promptFingerprint,
    },
    nowIso: input.nowIso,
  });

  const llmResult = await input.caller(batchPrompt);
  if (!llmResult.ok) {
    const providerReason = classifyLlmProviderFallbackReason({
      message: llmResult.message,
      providerSource: input.providerSource,
    });
    const failureReason: CodeTaskLlmBatchFailureReason =
      providerReason === "llm_timeout_fallback" ? "llm_timeout_fallback" : "llm_unavailable_fallback";
    return {
      source: "heuristic_fallback",
      tasks: input.batch.heuristicTasks,
      promptFingerprint,
      failureReason,
      timelineEntries: [
        batchRequestedEntry,
        buildPlanningLlmTimelineEntry({
          action: "implementation_code_task_llm_batch_failed",
          projectId: pid,
          fields: {
            batchId: input.batch.batchId,
            errorCode: "provider_failed",
            errorMessage: llmResult.message.slice(0, 200),
            providerSource: input.providerSource,
            model: input.modelName,
          },
          nowIso: input.nowIso,
        }),
        buildPlanningLlmTimelineEntry({
          action: "implementation_code_task_llm_batch_fallback_used",
          projectId: pid,
          fields: {
            batchId: input.batch.batchId,
            reason: failureReason,
            codeTaskCount: input.batch.codeTaskIds.length,
          },
          nowIso: input.nowIso,
        }),
      ],
    };
  }

  const parseRecovery = parseLlmJsonObjectWithRecovery(llmResult.text);
  const responseHash = hashLlmResponsePreview(llmResult.text);
  const previewStart = safeLlmResponsePreviewStart(llmResult.text);
  const parseAttemptEntries = appendLlmParseAttemptTimelineEntries({
    projectId: pid,
    nowIso: input.nowIso,
    attempts: parseRecovery.attempts,
    batchId: input.batch.batchId,
  });

  const batchTimeline: RequirementsPromptTimelineEntry[] = [batchRequestedEntry, ...parseAttemptEntries];

  if (parseRecovery.ok && parseRecovery.strategy !== "direct_json_parse") {
    batchTimeline.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_json_recovered",
        projectId: pid,
        fields: {
          batchId: input.batch.batchId,
          strategy: parseRecovery.strategy,
          rawLength: parseRecovery.rawLength,
          responseHash,
          providerSource: input.providerSource,
          model: input.modelName,
        },
        nowIso: input.nowIso,
      }),
    );
  }

  const parsedTasks = parseRecovery.ok ? parseLlmCodeTasksFromJson(parseRecovery.value) : null;
  if (!parseRecovery.ok || !parsedTasks) {
    const shapeInvalid = parseRecovery.ok;
    const failureReason: CodeTaskLlmBatchFailureReason = shapeInvalid
      ? "llm_shape_invalid_fallback"
      : "llm_parse_failed_fallback";
    const parseAttemptsSummary = formatLlmParseAttemptsForTimeline(parseRecovery.attempts);
    logLlmCodeTaskJsonDevPreview({
      phase: shapeInvalid ? "shape_invalid" : "parse_failed",
      projectId: pid,
      batchId: input.batch.batchId,
      responseHash,
      previewStart,
      parseAttemptsSummary,
      ...(!shapeInvalid && !parseRecovery.ok && parseRecovery.extractFailureReason
        ? { extractFailureReason: parseRecovery.extractFailureReason }
        : {}),
    });
    batchTimeline.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_batch_failed",
        projectId: pid,
        fields: {
          batchId: input.batch.batchId,
          errorCode: shapeInvalid ? "json_shape_invalid" : "json_parse_failed",
          parseAttemptsSummary,
          responseHash: shapeInvalid ? responseHash : parseRecovery.previewHash,
          ...(!shapeInvalid && !parseRecovery.ok && parseRecovery.extractFailureReason
            ? { extractFailureReason: parseRecovery.extractFailureReason }
            : {}),
        },
        nowIso: input.nowIso,
      }),
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_batch_fallback_used",
        projectId: pid,
        fields: { batchId: input.batch.batchId, reason: failureReason },
        nowIso: input.nowIso,
      }),
    );
    return {
      source: "heuristic_fallback",
      tasks: input.batch.heuristicTasks,
      promptFingerprint,
      resultFingerprint: buildLlmResultFingerprint(llmResult.text),
      usage: llmResult.usage ?? null,
      failureReason,
      timelineEntries: batchTimeline,
    };
  }

  if (parsedTasks.normalizeSource !== "root.tasks") {
    batchTimeline.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_json_normalized",
        projectId: pid,
        fields: {
          batchId: input.batch.batchId,
          normalizeSource: parsedTasks.normalizeSource,
          taskCount: parsedTasks.tasks.length,
          responseHash,
        },
        nowIso: input.nowIso,
      }),
    );
  }

  const batchValidation = validateBatchLlmTasks({
    basePlan: input.heuristicPlan,
    batch: input.batch,
    llmTasks: parsedTasks.tasks,
    taskList: input.taskList,
    nowIso: input.nowIso,
  });
  if (batchValidation.status === "failed") {
    batchTimeline.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_batch_failed",
        projectId: pid,
        fields: {
          batchId: input.batch.batchId,
          errorCode: "validation_failed",
          errorMessage: batchValidation.errors.slice(0, 3).join("; ").slice(0, 200),
        },
        nowIso: input.nowIso,
      }),
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_batch_fallback_used",
        projectId: pid,
        fields: { batchId: input.batch.batchId, reason: "llm_validation_failed_fallback" },
        nowIso: input.nowIso,
      }),
    );
    return {
      source: "heuristic_fallback",
      tasks: input.batch.heuristicTasks,
      promptFingerprint,
      resultFingerprint: buildLlmResultFingerprint(llmResult.text),
      usage: llmResult.usage ?? null,
      failureReason: "llm_validation_failed_fallback",
      timelineEntries: batchTimeline,
    };
  }

  batchTimeline.push(
    buildPlanningLlmTimelineEntry({
      action: "implementation_code_task_llm_batch_passed",
      projectId: pid,
      fields: {
        batchId: input.batch.batchId,
        refinedTaskCount: parsedTasks.tasks.length,
        ...(llmResult.usage?.totalTokens != null ? { totalTokens: llmResult.usage.totalTokens } : {}),
      },
      nowIso: input.nowIso,
    }),
  );

  return {
    source: "llm",
    tasks: parsedTasks.tasks,
    promptFingerprint,
    resultFingerprint: buildLlmResultFingerprint(llmResult.text),
    usage: llmResult.usage ?? null,
    timelineEntries: batchTimeline,
  };
}

function buildUnexpectedBatchFallbackResult(input: {
  readonly projectId: string;
  readonly batch: CodeTaskLlmRefinementBatch;
  readonly error: unknown;
  readonly nowIso: string;
}): CodeTaskLlmBatchProcessResult {
  const message =
    input.error instanceof Error ? input.error.message.slice(0, 200) : String(input.error ?? "unknown");
  const promptFingerprint = buildLlmPromptFingerprint(`unexpected:${input.batch.batchId}`);
  return {
    source: "heuristic_fallback",
    tasks: input.batch.heuristicTasks,
    promptFingerprint,
    failureReason: "llm_unavailable_fallback",
    timelineEntries: [
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_batch_requested",
        projectId: input.projectId,
        fields: {
          batchId: input.batch.batchId,
          batchIndex: input.batch.batchIndex,
          codeTaskCount: input.batch.codeTaskIds.length,
        },
        nowIso: input.nowIso,
      }),
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_batch_failed",
        projectId: input.projectId,
        fields: {
          batchId: input.batch.batchId,
          errorCode: "unexpected_exception",
          errorMessage: message,
        },
        nowIso: input.nowIso,
      }),
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_batch_fallback_used",
        projectId: input.projectId,
        fields: {
          batchId: input.batch.batchId,
          reason: "unexpected_exception_fallback",
        },
        nowIso: input.nowIso,
      }),
    ],
  };
}

function resolveBatchedRefinementOutcome(input: {
  readonly merge: ReturnType<typeof mergeBatchedCodeTaskRefinementResults>;
  readonly totalBatches: number;
  readonly dominantFailureReason?: CodeTaskLlmBatchFailureReason;
}): Readonly<{
  readonly refinementSource: ImplementationCodeTaskPlanRefinementSource;
  readonly refinementStatus: ImplementationCodeTaskPlanRefinementStatus;
  readonly fallbackUsed: boolean;
}> {
  const { merge, totalBatches } = input;
  if (merge.llmRefinedTaskCount === 0) {
    const status =
      input.dominantFailureReason ??
      (merge.fallbackBatches === totalBatches ? "llm_parse_failed_fallback" : "llm_unavailable_fallback");
    return {
      refinementSource: "llm_failed_heuristic_fallback",
      refinementStatus: status,
      fallbackUsed: true,
    };
  }
  if (merge.fallbackTaskCount === 0) {
    return {
      refinementSource: "llm_refined",
      refinementStatus: "llm_refined",
      fallbackUsed: false,
    };
  }
  return {
    refinementSource: "llm_partial_refined",
    refinementStatus: "llm_partial_refined",
    fallbackUsed: true,
  };
}

export async function refineImplementationCodeTaskPlanWithLlm(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly heuristicPlan: ImplementationCodeTaskPlanV1;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly nowIso?: string;
  readonly llmCaller?: LlmCodeTaskRefinementCaller;
  readonly forceLlm?: boolean;
  readonly providerContext?: LlmCodeTaskRefinementProviderContext | null;
  /** Project-level toggle (for clearer logging). */
  readonly enableLlmCodeTaskRefinement?: boolean;
}): Promise<{
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly usedLlm: boolean;
  readonly fallbackUsed: boolean;
  readonly validationReport: ImplementationCodeTaskPlanValidationReportV1;
  readonly errorMessage?: string;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}> {
  const now = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const heuristicTaskCount = input.heuristicPlan.tasks.length;
  let timelineEntries: RequirementsPromptTimelineEntry[] = [];

  const sourceTaskListFingerprint = buildSourceTaskListFingerprint(input.taskList);
  const sourceSeedFingerprint = buildSourceSeedFingerprint(input.implementationSeedV1);
  const refinementMetaBase = {
    sourceTaskListFingerprint,
    sourceSeedFingerprint,
  };

  const heuristicValidation = validateImplementationCodeTaskPlan({
    plan: input.heuristicPlan,
    taskList: input.taskList,
    nowIso: now,
  });

  timelineEntries.push(
    buildPlanningLlmTimelineEntry({
      action: "implementation_code_task_plan_validated",
      projectId: pid,
      fields: {
        validationStatus: heuristicValidation.status,
        heuristicTaskCount,
        source: "heuristic",
      },
      nowIso: now,
    }),
  );

  const projectSetting = input.enableLlmCodeTaskRefinement;
  const envFallback = isLlmCodeTaskRefinementEnabled();
  const llmEnabled =
    input.forceLlm === true ||
    projectSetting === true ||
    (projectSetting === undefined && envFallback);
  if (!llmEnabled) {
    const hasOpenaiPlannerApiKey = Boolean(String(input.providerContext?.apiKey ?? "").trim());
    const skipReason =
      projectSetting === false ? "disabled_by_project_setting" : "disabled";
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_skipped",
        projectId: pid,
        fields: {
          reason: skipReason,
          enableLlmCodeTaskRefinement: projectSetting === true,
          hasOpenaiPlannerApiKey,
          useLlm: false,
          skipReason,
        },
        nowIso: now,
      }),
    );
    const plan = buildPlanFromTasks({
      basePlan: input.heuristicPlan,
      tasks: input.heuristicPlan.tasks,
      refinementSource: "heuristic",
      refinementStatus: "heuristic_only",
      validationReport: heuristicValidation,
      heuristicTaskCount,
      nowIso: now,
      ...refinementMetaBase,
    });
    return {
      plan,
      usedLlm: false,
      fallbackUsed: true,
      validationReport: heuristicValidation,
      timelineEntries,
    };
  }

  timelineEntries.push(
    buildPlanningLlmTimelineEntry({
      action: "implementation_code_task_llm_refinement_requested",
      projectId: pid,
      fields: {
        heuristicTaskCount,
        sourceTaskListFingerprint,
        refinementStatus: "requested",
      },
      nowIso: now,
    }),
  );

  const batchPlan = buildCodeTaskLlmRefinementBatchPlan(input.heuristicPlan.tasks);
  const concurrency = resolveCodeTaskLlmBatchConcurrency();
  const caller = input.llmCaller ?? ((prompt) => defaultLlmCaller(prompt, input.providerContext));
  const providerSource = String(input.providerContext?.providerSource ?? "none");
  const modelName = String(input.providerContext?.model ?? resolveOpenAiModelFromEnv());
  const refinementRequestedAt = now;
  const projectArtifactsSummary = summarizeArtifacts(input.projectArtifacts) || "(none)";
  const implementationSeedSummary = summarizeSeed(input.implementationSeedV1);
  const refinementStartedAtMs = Date.now();

  timelineEntries.push(
    buildPlanningLlmTimelineEntry({
      action: "implementation_code_task_llm_refinement_batch_planned",
      projectId: pid,
      fields: {
        heuristicTaskCount,
        batchCount: batchPlan.batches.length,
        concurrency,
        sourceTaskListFingerprint,
      },
      nowIso: now,
    }),
  );

  const batchResults = await runWithConcurrency(
    batchPlan.batches,
    concurrency,
    async (batch) => {
      try {
        return await processCodeTaskLlmBatch({
          projectId: pid,
          batch,
          heuristicPlan: input.heuristicPlan,
          taskList: input.taskList,
          projectArtifactsSummary,
          implementationSeedSummary,
          caller,
          providerSource,
          modelName,
          nowIso: now,
        });
      } catch (error) {
        return buildUnexpectedBatchFallbackResult({
          projectId: pid,
          batch,
          error,
          nowIso: now,
        });
      }
    },
  );

  const elapsedMs = Date.now() - refinementStartedAtMs;
  const batchOutcomes: Array<{
    readonly batch: CodeTaskLlmRefinementBatch;
    readonly tasks: readonly ImplementationCodeTaskV1[];
    readonly source: "llm" | "heuristic_fallback";
  }> = [];
  const promptFingerprints: string[] = [];
  const resultFingerprints: string[] = [];
  let aggregatedUsage: ImplementationCodeTaskPlanLlmUsage | null = null;
  let dominantFailureReason: CodeTaskLlmBatchFailureReason | undefined;

  for (const batchResult of batchResults) {
    timelineEntries.push(...batchResult.timelineEntries);
    promptFingerprints.push(batchResult.promptFingerprint);
    if (batchResult.resultFingerprint) resultFingerprints.push(batchResult.resultFingerprint);
    aggregatedUsage = mergeLlmUsage(aggregatedUsage, batchResult.usage);
    if (batchResult.failureReason && !dominantFailureReason) {
      dominantFailureReason = batchResult.failureReason;
    }
  }

  batchPlan.batches.forEach((batch, index) => {
    const batchResult = batchResults[index];
    if (!batchResult) return;
    batchOutcomes.push({
      batch,
      tasks: batchResult.tasks,
      source: batchResult.source,
    });
  });

  const merge = mergeBatchedCodeTaskRefinementResults({
    heuristicTasks: input.heuristicPlan.tasks,
    batchOutcomes,
  });
  const llmRefinementSummary: ImplementationCodeTaskPlanLlmRefinementSummaryV1 = {
    totalBatches: batchPlan.batches.length,
    llmRefinedBatches: merge.llmRefinedBatches,
    fallbackBatches: merge.fallbackBatches,
    llmRefinedTaskCount: merge.llmRefinedTaskCount,
    fallbackTaskCount: merge.fallbackTaskCount,
    concurrency,
    elapsedMs,
  };
  const outcome = resolveBatchedRefinementOutcome({
    merge,
    totalBatches: batchPlan.batches.length,
    dominantFailureReason,
  });
  const llmPromptFingerprint = buildLlmPromptFingerprint(promptFingerprints.join("|"));
  const llmResultFingerprint = resultFingerprints.length
    ? buildLlmResultFingerprint(resultFingerprints.join("|"))
    : undefined;

  const mergedPlanDraft = buildMergedPlanDraft({
    basePlan: input.heuristicPlan,
    mergedTasks: merge.mergedTasks,
  });
  const finalValidation = validateImplementationCodeTaskPlan({
    plan: mergedPlanDraft,
    taskList: input.taskList,
    nowIso: now,
  });

  timelineEntries.push(
    buildPlanningLlmTimelineEntry({
      action: "implementation_code_task_plan_validated",
      projectId: pid,
      fields: {
        validationStatus: finalValidation.status,
        refinedTaskCount: merge.mergedTasks.length,
        llmRefinedTaskCount: merge.llmRefinedTaskCount,
        fallbackTaskCount: merge.fallbackTaskCount,
        source: outcome.refinementStatus === "llm_partial_refined" ? "llm_partial" : "llm",
      },
      nowIso: now,
    }),
  );

  if (outcome.refinementStatus === "llm_partial_refined") {
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_partial",
        projectId: pid,
        fields: {
          refinementStatus: outcome.refinementStatus,
          llmRefinedBatches: merge.llmRefinedBatches,
          fallbackBatches: merge.fallbackBatches,
          llmRefinedTaskCount: merge.llmRefinedTaskCount,
          fallbackTaskCount: merge.fallbackTaskCount,
          batchCount: batchPlan.batches.length,
          concurrency,
          elapsedMs,
          ...(aggregatedUsage?.totalTokens != null ? { totalTokens: aggregatedUsage.totalTokens } : {}),
        },
        nowIso: now,
      }),
    );
  } else if (outcome.refinementStatus === "llm_refined") {
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_passed",
        projectId: pid,
        fields: {
          refinedTaskCount: merge.llmRefinedTaskCount,
          heuristicTaskCount,
          batchCount: batchPlan.batches.length,
          concurrency,
          elapsedMs,
          llmPromptFingerprint,
          sourceTaskListFingerprint,
          refinementStatus: "llm_refined",
          fallbackUsed: false,
          ...(aggregatedUsage?.totalTokens != null ? { totalTokens: aggregatedUsage.totalTokens } : {}),
        },
        nowIso: now,
      }),
    );
  } else {
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_fallback_used",
        projectId: pid,
        fields: {
          fallbackUsed: true,
          reason: outcome.refinementStatus,
          batchCount: batchPlan.batches.length,
          concurrency,
          elapsedMs,
          fallbackBatches: merge.fallbackBatches,
          llmPromptFingerprint,
          providerSource,
          refinementStatus: outcome.refinementStatus,
        },
        nowIso: now,
      }),
    );
  }

  const plan = buildPlanFromTasks({
    basePlan: input.heuristicPlan,
    tasks: merge.mergedTasks,
    refinementSource: outcome.refinementSource,
    refinementStatus: outcome.refinementStatus,
    validationReport: finalValidation,
    heuristicTaskCount,
    nowIso: now,
    ...(merge.llmRefinedTaskCount > 0 ? { llmRefinedAt: now } : {}),
    ...refinementMetaBase,
    llmPromptFingerprint,
    ...(llmResultFingerprint ? { llmResultFingerprint } : {}),
    refinementRequestedAt,
    refinementCompletedAt: now,
    llmUsage: aggregatedUsage,
    llmRefinementSummary,
  });

  return {
    plan,
    usedLlm: merge.llmRefinedTaskCount > 0,
    fallbackUsed: outcome.fallbackUsed,
    validationReport: finalValidation,
    ...(finalValidation.status === "failed" ? { errorMessage: finalValidation.errors[0] } : {}),
    timelineEntries,
  };
}

export async function resolveImplementationCodeTaskPlanForPlanningReadiness(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly heuristicPlan: ImplementationCodeTaskPlanV1;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly nowIso?: string;
  readonly useLlmRefinement?: boolean;
  readonly llmCaller?: LlmCodeTaskRefinementCaller;
  readonly providerContext?: LlmCodeTaskRefinementProviderContext | null;
  readonly enableLlmCodeTaskRefinement?: boolean;
  readonly hasOpenaiPlannerApiKey?: boolean;
  readonly skipReason?: string;
}): Promise<{
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}> {
  const now = input.nowIso ?? new Date().toISOString();
  if (input.useLlmRefinement) {
    const refined = await refineImplementationCodeTaskPlanWithLlm({
      projectId: input.projectId,
      taskList: input.taskList,
      heuristicPlan: input.heuristicPlan,
      projectArtifacts: input.projectArtifacts,
      implementationSeedV1: input.implementationSeedV1,
      envOk: input.envOk,
      designOk: input.designOk,
      nowIso: now,
      llmCaller: input.llmCaller,
      providerContext: input.providerContext,
      forceLlm: true,
      enableLlmCodeTaskRefinement: input.enableLlmCodeTaskRefinement,
    });
    return { plan: refined.plan, timelineEntries: refined.timelineEntries };
  }

  const validationReport = validateImplementationCodeTaskPlan({
    plan: input.heuristicPlan,
    taskList: input.taskList,
    nowIso: now,
  });
  const plan: ImplementationCodeTaskPlanV1 = {
    ...input.heuristicPlan,
    validationReport,
    refinementSource: "heuristic",
    refinementStatus: "heuristic_only",
    heuristicTaskCount: input.heuristicPlan.tasks.length,
    refinedTaskCount: input.heuristicPlan.tasks.length,
  };
  return {
    plan,
    timelineEntries: [
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_plan_validated",
        projectId: input.projectId.trim(),
        fields: {
          validationStatus: validationReport.status,
          heuristicTaskCount: input.heuristicPlan.tasks.length,
          source: "heuristic",
        },
        nowIso: now,
      }),
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_skipped",
        projectId: input.projectId.trim(),
        fields: {
          reason: input.skipReason ?? "llm_refinement_not_used",
          enableLlmCodeTaskRefinement: input.enableLlmCodeTaskRefinement === true,
          hasOpenaiPlannerApiKey: input.hasOpenaiPlannerApiKey === true,
          useLlm: false,
          skipReason: input.skipReason ?? "llm_refinement_not_used",
        },
        nowIso: now,
      }),
    ],
  };
}
