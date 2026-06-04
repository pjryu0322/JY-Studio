import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  CODE_TASK_PROMPT_CONTEXT_MAP_VERSION,
  CODE_TASK_PROMPT_CONTEXT_VERSION,
  type CodeTaskPromptContextMapV1,
  type CodeTaskPromptContextV1,
} from "@/lib/prototype/codeTaskPromptContext";
import { parseImplementationSeedV1, type ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import {
  parseImplementationTaskListV1,
  type ImplementationTaskListV1,
} from "@/lib/requirements/implementationTaskList";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

function uniq(items: readonly string[]): string[] {
  return [
    ...new Set(
      items
        .map((x) => String(x ?? "").trim())
        .filter(Boolean),
    ),
  ];
}

function haystack(text: string): string {
  return text.toLowerCase();
}

function matchesToken(text: string, token: string): boolean {
  const t = token.trim().toLowerCase();
  if (!t || t.length < 2) return false;
  return haystack(text).includes(t);
}

function extractPlanningSummary(state: Record<string, unknown>): {
  readonly serviceGoal?: string;
  readonly problemToSolve?: string;
  readonly targetUsers: readonly string[];
} {
  const seed = parseImplementationSeedV1(state.implementationSeedV1);
  const organize = state.organizeContext;
  let serviceGoal: string | undefined;
  let problemToSolve: string | undefined;
  const targetUsers: string[] = [];

  if (seed?.templateContext) {
    const tc = seed.templateContext;
    serviceGoal = tc.description?.trim() || tc.templateNameKo?.trim() || undefined;
    problemToSolve =
      tc.layoutContract?.trim().slice(0, 200) ||
      (tc.primarySections?.[0] ? String(tc.primarySections[0]).trim() : undefined);
    if (tc.navigationItems?.length) {
      targetUsers.push(...tc.navigationItems.slice(0, 3).map((x) => String(x).trim()).filter(Boolean));
    }
  }

  if (organize && typeof organize === "object") {
    const o = organize as Record<string, unknown>;
    if (!serviceGoal) {
      serviceGoal = String(o.serviceSummary ?? o.productSummary ?? o.summary ?? "").trim() || undefined;
    }
    if (!problemToSolve) {
      problemToSolve = String(o.problemToSolve ?? o.userProblem ?? "").trim() || undefined;
    }
  }

  const artifacts = Array.isArray(state.projectArtifacts)
    ? (state.projectArtifacts as ProjectArtifact[])
    : [];
  const featureSpec = artifacts.find((a) => a.type === "feature-spec");
  if (!serviceGoal && featureSpec?.title) {
    serviceGoal = featureSpec.title.trim();
  }
  if (!problemToSolve && featureSpec?.content) {
    const first = featureSpec.content.split("\n").map((l) => l.trim()).find(Boolean);
    if (first) problemToSolve = first.slice(0, 240);
  }

  return { serviceGoal, problemToSolve, targetUsers: uniq(targetUsers) };
}

function seedFlowContext(seed: ImplementationSeedV1): CodeTaskPromptContextV1["flowContext"] {
  const actors = uniq(seed.actorCapabilityMatrix.map((r) => r.actor));
  const flows = uniq(
    seed.processImplementationItems.flatMap((p) => [
      p.processName,
      ...(Array.isArray(p.actions) ? p.actions : []).slice(0, 2),
    ]),
  );
  const steps = uniq(seed.processImplementationItems.map((p) => p.processName));
  return {
    relatedActors: actors.slice(0, 8),
    relatedUserFlows: flows.slice(0, 8),
    relatedServiceSteps: steps.slice(0, 8),
  };
}

function seedFeatureContext(seed: ImplementationSeedV1): CodeTaskPromptContextV1["featureContext"] {
  return {
    relatedFeatures: uniq(seed.commonDetailFeatures.map((f) => f.name)).slice(0, 12),
    relatedScreens: uniq(seed.screenImplementationItems.map((s) => s.screenName)).slice(0, 12),
    relatedStates: uniq(
      seed.screenImplementationItems.flatMap((s) =>
        Array.isArray(s.states) ? s.states : [],
      ),
    ).slice(0, 12),
    inputs: [],
    outputs: [],
  };
}

function matchCodeTaskToSeed(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly seed: ImplementationSeedV1;
}): {
  readonly features: readonly string[];
  readonly screens: readonly string[];
  readonly states: readonly string[];
  readonly flows: readonly string[];
} {
  const text = haystack(`${input.codeTask.title} ${input.codeTask.description}`);
  const features: string[] = [];
  const screens: string[] = [];
  const states: string[] = [];
  const flows: string[] = [];

  for (const f of input.seed.commonDetailFeatures) {
    if (matchesToken(text, f.name)) features.push(f.name);
  }
  for (const s of input.seed.screenImplementationItems) {
    if (matchesToken(text, s.screenName)) screens.push(s.screenName);
    const screenStates = Array.isArray(s.states) ? s.states : [];
    for (const st of screenStates) {
      if (matchesToken(text, st)) states.push(st);
    }
  }
  for (const p of input.seed.processImplementationItems) {
    if (matchesToken(text, p.processName)) flows.push(p.processName);
  }

  return {
    features: uniq(features),
    screens: uniq(screens),
    states: uniq(states),
    flows: uniq(flows),
  };
}

function buildContextForCodeTask(input: {
  readonly projectId: string;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask: ImplementationTaskListV1["tasks"][number] | null;
  readonly seed: ImplementationSeedV1 | null;
  readonly planningSummary: ReturnType<typeof extractPlanningSummary>;
  readonly nowIso: string;
}): CodeTaskPromptContextV1 {
  const missing: string[] = [];
  const warnings: string[] = [];
  const parent = input.parentTask;
  const seed = input.seed;
  const matched = seed ? matchCodeTaskToSeed({ codeTask: input.codeTask, seed }) : null;

  let source: CodeTaskPromptContextV1["source"] = "heuristic_fallback";
  if (seed) source = "planning_artifacts";

  const planningContext = {
    serviceGoal:
      input.planningSummary.serviceGoal ??
      (parent?.description?.trim() ? parent.description.trim().slice(0, 200) : undefined),
    targetUsers: input.planningSummary.targetUsers.length
      ? input.planningSummary.targetUsers
      : seed
        ? uniq(seed.actorCapabilityMatrix.map((r) => r.actor)).slice(0, 4)
        : [],
    problemToSolve: input.planningSummary.problemToSolve ?? parent?.title?.trim(),
    businessGoal: parent?.title?.trim() || undefined,
  };

  const flowContext = seed
    ? {
        relatedActors: uniq([
          ...seedFlowContext(seed).relatedActors,
          ...(matched?.flows.length ? seed.actorCapabilityMatrix.map((r) => r.actor) : []),
        ]).slice(0, 8),
        relatedUserFlows: uniq([...seedFlowContext(seed).relatedUserFlows, ...(matched?.flows ?? [])]).slice(
          0,
          8,
        ),
        relatedServiceSteps: seedFlowContext(seed).relatedServiceSteps,
      }
    : { relatedActors: [], relatedUserFlows: [], relatedServiceSteps: [] };

  const featureContext = seed
    ? {
        relatedFeatures: uniq([
          ...seedFeatureContext(seed).relatedFeatures,
          ...(matched?.features ?? []),
        ]).slice(0, 10),
        relatedScreens: uniq([...seedFeatureContext(seed).relatedScreens, ...(matched?.screens ?? [])]).slice(
          0,
          10,
        ),
        relatedStates: uniq([...seedFeatureContext(seed).relatedStates, ...(matched?.states ?? [])]).slice(
          0,
          10,
        ),
        inputs: [],
        outputs: [],
      }
    : { relatedFeatures: [], relatedScreens: [], relatedStates: [], inputs: [], outputs: [] };

  const intent =
    input.codeTask.description.trim() ||
    input.codeTask.title.trim() ||
    parent?.description?.trim() ||
    "기획 범위에 맞는 기능을 구현한다.";

  const implementationContext = {
    intent,
    requirements: uniq([
      ...input.codeTask.acceptanceCriteria,
      input.codeTask.title,
    ]).slice(0, 12),
    constraints: uniq(input.codeTask.forbiddenPaths ?? []).slice(0, 8),
    expectedBehavior: parent?.acceptanceCriteria?.length
      ? [...parent.acceptanceCriteria].slice(0, 6)
      : [],
    edgeCases: [],
  };

  const verificationContext = {
    acceptanceCriteria: [...input.codeTask.acceptanceCriteria],
    manualChecks: uniq(input.codeTask.verificationHints ?? []).slice(0, 6),
    regressionChecks: ["동일 기능 회귀 없음", "관련 화면·상태 흐름 회귀 없음"],
  };

  if (!planningContext.serviceGoal) missing.push("serviceGoal");
  if (!planningContext.problemToSolve) missing.push("problemToSolve");
  if (!flowContext.relatedUserFlows.length) warnings.push("relatedUserFlows");
  if (!featureContext.relatedFeatures.length && !featureContext.relatedScreens.length) {
    warnings.push("relatedFeaturesOrScreens");
  }
  if (!seed) warnings.push("implementationSeedV1");

  const ready =
    Boolean(planningContext.serviceGoal || planningContext.problemToSolve) &&
    Boolean(implementationContext.intent) &&
    implementationContext.requirements.length > 0;

  return {
    version: CODE_TASK_PROMPT_CONTEXT_VERSION,
    projectId: input.projectId.trim(),
    codeTaskId: input.codeTask.codeTaskId,
    parentTaskId: input.codeTask.parentTaskId,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
    source,
    planningContext,
    flowContext,
    featureContext,
    implementationContext,
    verificationContext,
    quality: { ready, missing, warnings },
  };
}

export function buildCodeTaskPromptContextMap(input: {
  readonly projectId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly requirementsStateJson: Record<string, unknown>;
  readonly nowIso?: string;
}): CodeTaskPromptContextMapV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const state = input.requirementsStateJson ?? {};
  const taskList = parseImplementationTaskListV1(state.implementationTaskListV1);
  const seed = parseImplementationSeedV1(state.implementationSeedV1);
  const planningSummary = extractPlanningSummary(state);
  const contexts: Record<string, CodeTaskPromptContextV1> = {};

  for (const codeTask of input.codeTaskPlan.tasks) {
    const id = codeTask.codeTaskId.trim();
    if (!id) continue;
    const parentTask =
      taskList?.tasks.find((t) => t.taskId === codeTask.parentTaskId) ?? null;
    contexts[id] = buildContextForCodeTask({
      projectId: pid,
      codeTask,
      parentTask,
      seed,
      planningSummary,
      nowIso: now,
    });
  }

  return {
    version: CODE_TASK_PROMPT_CONTEXT_MAP_VERSION,
    projectId: pid,
    createdAt: now,
    updatedAt: now,
    contexts,
  };
}
