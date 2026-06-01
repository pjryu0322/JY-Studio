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
import {
  COMMON_FORBIDDEN_PATHS,
} from "@/lib/prototype/implementationExecutionHints";
import {
  IMPLEMENTATION_CODE_TASK_CHANGE_TYPES,
  IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
  type ImplementationCodeTaskChangeType,
  type ImplementationCodeTaskPlanV1,
  type ImplementationCodeTaskPlanRefinementSource,
  type ImplementationCodeTaskPlanRefinementStatus,
  type ImplementationCodeTaskPlanValidationReportV1,
  type ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { validateImplementationCodeTaskPlan } from "@/lib/prototype/implementationCodeTaskPlanValidator";
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
}): RequirementsPromptTimelineEntry[] {
  return input.attempts.map((attempt) =>
    buildPlanningLlmTimelineEntry({
      action: "implementation_code_task_llm_parse_attempt",
      projectId: input.projectId,
      fields: {
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
}): ImplementationCodeTaskPlanV1 {
  const missing = [...(input.basePlan.readiness.missing ?? [])];
  if (input.tasks.some((task) => task.status === "blocked")) missing.push("blocked CodeTask 존재");
  if (input.tasks.some((task) => task.status === "draft")) missing.push("draft CodeTask 존재");
  if (input.validationReport.status === "failed") missing.push("CodeTaskPlan validation failed");

  const plan: ImplementationCodeTaskPlanV1 = {
    ...input.basePlan,
    updatedAt: input.nowIso,
    tasks: input.tasks,
    codeTaskCount: input.tasks.length,
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
    maxTokens: 4096,
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

  const caller = input.llmCaller ?? ((prompt) => defaultLlmCaller(prompt, input.providerContext));
  const prompt = buildCodeTaskLlmRefinementUserPrompt({
    projectId: pid,
    taskList: input.taskList,
    heuristicPlan: input.heuristicPlan,
    projectArtifacts: input.projectArtifacts,
    implementationSeedV1: input.implementationSeedV1,
  });
  const llmPromptFingerprint = buildLlmPromptFingerprint(prompt);
  const refinementRequestedAt = now;
  const llmResult = await caller(prompt);

  const providerSource = String(input.providerContext?.providerSource ?? "none");
  const modelName = String(input.providerContext?.model ?? resolveOpenAiModelFromEnv());

  if (!llmResult.ok) {
    const providerReason = classifyLlmProviderFallbackReason({
      message: llmResult.message,
      providerSource,
    });
    const refinementStatus =
      providerReason === "llm_timeout_fallback" ? "llm_timeout_fallback" : "llm_unavailable_fallback";
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_failed",
        projectId: pid,
        fields: {
          errorCode: "provider_failed",
          errorMessage: llmResult.message.slice(0, 200),
          providerSource,
          model: modelName,
        },
        nowIso: now,
      }),
    );
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_fallback_used",
        projectId: pid,
        fields: {
          fallbackUsed: true,
          reason: providerReason,
          llmPromptFingerprint,
          providerSource,
          refinementStatus,
        },
        nowIso: now,
      }),
    );
    const plan = buildPlanFromTasks({
      basePlan: input.heuristicPlan,
      tasks: input.heuristicPlan.tasks,
      refinementSource: "heuristic",
      refinementStatus,
      validationReport: heuristicValidation,
      heuristicTaskCount,
      nowIso: now,
      ...refinementMetaBase,
      llmPromptFingerprint,
      refinementRequestedAt,
      refinementCompletedAt: now,
    });
    return {
      plan,
      usedLlm: false,
      fallbackUsed: true,
      validationReport: heuristicValidation,
      errorMessage: llmResult.message,
      timelineEntries,
    };
  }

  const parseRecovery = parseLlmJsonObjectWithRecovery(llmResult.text);
  const responseHash = hashLlmResponsePreview(llmResult.text);
  const previewStart = safeLlmResponsePreviewStart(llmResult.text);

  timelineEntries.push(
    ...appendLlmParseAttemptTimelineEntries({
      projectId: pid,
      nowIso: now,
      attempts: parseRecovery.attempts,
    }),
  );

  if (parseRecovery.ok && parseRecovery.strategy !== "direct_json_parse") {
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_json_recovered",
        projectId: pid,
        fields: {
          strategy: parseRecovery.strategy,
          rawLength: parseRecovery.rawLength,
          responseHash,
          providerSource,
          model: modelName,
        },
        nowIso: now,
      }),
    );
  }

  const parsedTasks = parseRecovery.ok ? parseLlmCodeTasksFromJson(parseRecovery.value) : null;
  if (!parseRecovery.ok || !parsedTasks) {
    const shapeInvalid = parseRecovery.ok;
    const message = shapeInvalid ? "LLM CodeTask JSON shape invalid" : "LLM CodeTask JSON parse failed";
    const lastAttempt = parseRecovery.attempts[parseRecovery.attempts.length - 1];
    const parseStrategy = shapeInvalid ? "parsed_but_invalid_shape" : (lastAttempt?.strategy ?? "unknown");
    const parseAttemptsSummary = formatLlmParseAttemptsForTimeline(parseRecovery.attempts);
    const refinementStatus = shapeInvalid ? "llm_shape_invalid_fallback" : "llm_parse_failed_fallback";
    const fallbackReason = shapeInvalid ? "llm_shape_invalid_fallback" : "llm_parse_failed_fallback";

    logLlmCodeTaskJsonDevPreview({
      phase: shapeInvalid ? "shape_invalid" : "parse_failed",
      projectId: pid,
      responseHash,
      previewStart,
      parseAttemptsSummary,
      ...(!shapeInvalid && !parseRecovery.ok && parseRecovery.extractFailureReason
        ? { extractFailureReason: parseRecovery.extractFailureReason }
        : {}),
    });

    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_failed",
        projectId: pid,
        fields: {
          errorCode: shapeInvalid ? "json_shape_invalid" : "json_parse_failed",
          errorMessage: message,
          parseStrategy,
          parseAttemptsSummary,
          rawLength: shapeInvalid ? llmResult.text.length : parseRecovery.rawLength,
          responseHash: shapeInvalid ? responseHash : parseRecovery.previewHash,
          providerSource,
          model: modelName,
          ...(!shapeInvalid && !parseRecovery.ok && parseRecovery.extractFailureReason
            ? { extractFailureReason: parseRecovery.extractFailureReason }
            : {}),
        },
        nowIso: now,
      }),
    );
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_fallback_used",
        projectId: pid,
        fields: {
          fallbackUsed: true,
          reason: fallbackReason,
          llmPromptFingerprint,
          providerSource,
          refinementStatus,
        },
        nowIso: now,
      }),
    );
    const llmResultFingerprint = buildLlmResultFingerprint(llmResult.text);
    const plan = buildPlanFromTasks({
      basePlan: input.heuristicPlan,
      tasks: input.heuristicPlan.tasks,
      refinementSource: "llm_failed_heuristic_fallback",
      refinementStatus,
      validationReport: heuristicValidation,
      heuristicTaskCount,
      nowIso: now,
      ...refinementMetaBase,
      llmPromptFingerprint,
      llmResultFingerprint,
      refinementRequestedAt,
      refinementCompletedAt: now,
      llmUsage: llmResult.usage ?? null,
    });
    return {
      plan,
      usedLlm: true,
      fallbackUsed: true,
      validationReport: heuristicValidation,
      errorMessage: message,
      timelineEntries,
    };
  }

  const llmTasks = parsedTasks.tasks;
  if (parsedTasks.normalizeSource !== "root.tasks") {
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_json_normalized",
        projectId: pid,
        fields: {
          normalizeSource: parsedTasks.normalizeSource,
          taskCount: llmTasks.length,
          responseHash,
          providerSource,
          model: modelName,
        },
        nowIso: now,
      }),
    );
    logLlmCodeTaskJsonDevPreview({
      phase: "json_normalized",
      projectId: pid,
      normalizeSource: parsedTasks.normalizeSource,
      taskCount: llmTasks.length,
      responseHash,
      previewStart,
    });
  }

  const llmPlanDraft: ImplementationCodeTaskPlanV1 = {
    ...input.heuristicPlan,
    version: IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
    tasks: llmTasks,
    codeTaskCount: llmTasks.length,
  };
  const llmValidation = validateImplementationCodeTaskPlan({
    plan: llmPlanDraft,
    taskList: input.taskList,
    nowIso: now,
  });

  timelineEntries.push(
    buildPlanningLlmTimelineEntry({
      action: "implementation_code_task_plan_validated",
      projectId: pid,
      fields: {
        validationStatus: llmValidation.status,
        refinedTaskCount: llmTasks.length,
        source: "llm",
      },
      nowIso: now,
    }),
  );

  if (llmValidation.status === "failed") {
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_failed",
        projectId: pid,
        fields: {
          errorCode: "validation_failed",
          errorMessage: llmValidation.errors.slice(0, 3).join("; ").slice(0, 200),
          validationStatus: "failed",
          providerSource,
          model: modelName,
        },
        nowIso: now,
      }),
    );
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_fallback_used",
        projectId: pid,
        fields: {
          fallbackUsed: true,
          reason: "llm_validation_failed_fallback",
          heuristicTaskCount,
          llmPromptFingerprint,
          refinementStatus: "llm_validation_failed_fallback",
        },
        nowIso: now,
      }),
    );
    const llmResultFingerprint = buildLlmResultFingerprint(llmResult.text);
    const plan = buildPlanFromTasks({
      basePlan: input.heuristicPlan,
      tasks: input.heuristicPlan.tasks,
      refinementSource: "llm_failed_heuristic_fallback",
      refinementStatus: "llm_validation_failed_fallback",
      validationReport: heuristicValidation,
      heuristicTaskCount,
      nowIso: now,
      ...refinementMetaBase,
      llmPromptFingerprint,
      llmResultFingerprint,
      refinementRequestedAt,
      refinementCompletedAt: now,
      llmUsage: llmResult.usage ?? null,
    });
    return {
      plan,
      usedLlm: true,
      fallbackUsed: true,
      validationReport: llmValidation,
      errorMessage: llmValidation.errors[0],
      timelineEntries,
    };
  }

  timelineEntries.push(
    buildPlanningLlmTimelineEntry({
      action: "implementation_code_task_llm_refinement_passed",
      projectId: pid,
      fields: {
        refinedTaskCount: llmTasks.length,
        heuristicTaskCount,
        llmPromptFingerprint,
        sourceTaskListFingerprint,
        refinementStatus: "llm_refined",
        fallbackUsed: false,
        ...(llmResult.usage?.totalTokens != null
          ? { totalTokens: llmResult.usage.totalTokens }
          : {}),
      },
      nowIso: now,
    }),
  );

  const llmResultFingerprint = buildLlmResultFingerprint(llmResult.text);
  const plan = buildPlanFromTasks({
    basePlan: input.heuristicPlan,
    tasks: llmTasks,
    refinementSource: "llm_refined",
    refinementStatus: "llm_refined",
    validationReport: llmValidation,
    heuristicTaskCount,
    nowIso: now,
    llmRefinedAt: now,
    ...refinementMetaBase,
    llmPromptFingerprint,
    llmResultFingerprint,
    refinementRequestedAt,
    refinementCompletedAt: now,
    llmUsage: llmResult.usage ?? null,
  });
  return {
    plan,
    usedLlm: true,
    fallbackUsed: false,
    validationReport: llmValidation,
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
