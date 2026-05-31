import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiFromEnv, resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
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

export type LlmCodeTaskRefinementCaller = (
  prompt: string,
) => Promise<
  | Readonly<{ readonly ok: true; readonly text: string }>
  | Readonly<{ readonly ok: false; readonly message: string }>
>;

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

function parseLlmCodeTasksFromJson(raw: unknown): readonly ImplementationCodeTaskV1[] | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tasksRaw = Array.isArray(o.tasks) ? o.tasks : null;
  if (!tasksRaw) return null;

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
  return tasks.length ? tasks : null;
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
}): ImplementationCodeTaskPlanV1 {
  const missing = [...(input.basePlan.readiness.missing ?? [])];
  if (input.tasks.some((task) => task.status === "blocked")) missing.push("blocked CodeTask 존재");
  if (input.tasks.some((task) => task.status === "draft")) missing.push("draft CodeTask 존재");
  if (input.validationReport.status === "failed") missing.push("CodeTaskPlan validation failed");

  return {
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
}

async function defaultLlmCaller(
  prompt: string,
  providerContext?: LlmCodeTaskRefinementProviderContext | null,
): Promise<
  | Readonly<{ readonly ok: true; readonly text: string }>
  | Readonly<{ readonly ok: false; readonly message: string }>
> {
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
    messages: [
      {
        role: "system",
        content:
          "You refine implementation code task plans for JYOrchestration. Output JSON only. Keep scope inside projects/JYOrchestration.",
      },
      { role: "user", content: prompt },
    ],
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, text: result.text };
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

  const llmEnabled = input.forceLlm === true || isLlmCodeTaskRefinementEnabled();
  if (!llmEnabled) {
    const plan = buildPlanFromTasks({
      basePlan: input.heuristicPlan,
      tasks: input.heuristicPlan.tasks,
      refinementSource: "heuristic",
      refinementStatus: "heuristic_only",
      validationReport: heuristicValidation,
      heuristicTaskCount,
      nowIso: now,
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
      fields: { heuristicTaskCount },
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
  const llmResult = await caller(prompt);

  if (!llmResult.ok) {
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_failed",
        projectId: pid,
        fields: { errorMessage: llmResult.message.slice(0, 200) },
        nowIso: now,
      }),
    );
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_fallback_used",
        projectId: pid,
        fields: { fallbackUsed: true, reason: "llm_unavailable" },
        nowIso: now,
      }),
    );
    const plan = buildPlanFromTasks({
      basePlan: input.heuristicPlan,
      tasks: input.heuristicPlan.tasks,
      refinementSource: "heuristic",
      refinementStatus: "llm_unavailable_fallback",
      validationReport: heuristicValidation,
      heuristicTaskCount,
      nowIso: now,
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

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(llmResult.text);
  } catch {
    parsedJson = null;
  }
  const llmTasks = parseLlmCodeTasksFromJson(parsedJson);
  if (!llmTasks) {
    const message = "LLM CodeTask JSON parse failed";
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_failed",
        projectId: pid,
        fields: { errorMessage: message },
        nowIso: now,
      }),
    );
    timelineEntries.push(
      buildPlanningLlmTimelineEntry({
        action: "implementation_code_task_llm_refinement_fallback_used",
        projectId: pid,
        fields: { fallbackUsed: true, reason: "parse_failed" },
        nowIso: now,
      }),
    );
    const plan = buildPlanFromTasks({
      basePlan: input.heuristicPlan,
      tasks: input.heuristicPlan.tasks,
      refinementSource: "llm_failed_heuristic_fallback",
      refinementStatus: "llm_parse_failed_fallback",
      validationReport: heuristicValidation,
      heuristicTaskCount,
      nowIso: now,
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
          errorMessage: llmValidation.errors.slice(0, 3).join("; ").slice(0, 200),
          validationStatus: "failed",
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
          reason: "validation_failed",
          heuristicTaskCount,
        },
        nowIso: now,
      }),
    );
    const plan = buildPlanFromTasks({
      basePlan: input.heuristicPlan,
      tasks: input.heuristicPlan.tasks,
      refinementSource: "llm_failed_heuristic_fallback",
      refinementStatus: "llm_validation_failed",
      validationReport: heuristicValidation,
      heuristicTaskCount,
      nowIso: now,
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
      },
      nowIso: now,
    }),
  );

  const plan = buildPlanFromTasks({
    basePlan: input.heuristicPlan,
    tasks: llmTasks,
    refinementSource: "llm_refined",
    refinementStatus: "llm_refined",
    validationReport: llmValidation,
    heuristicTaskCount,
    nowIso: now,
    llmRefinedAt: now,
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
    ],
  };
}
