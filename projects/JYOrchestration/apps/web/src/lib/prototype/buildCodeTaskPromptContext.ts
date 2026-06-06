import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  CODE_TASK_PROMPT_CONTEXT_MAP_VERSION,
  CODE_TASK_PROMPT_CONTEXT_VERSION,
  type CodeTaskPromptContextMapV1,
  type CodeTaskPromptContextV1,
} from "@/lib/prototype/codeTaskPromptContext";
import { resolveCodeTaskFeaturePromptTemplate } from "@/lib/prototype/codeTaskPromptFeatureTemplates";
import { sanitizePlanningPromptText } from "@/lib/prototype/codeTaskPromptPlanningSanitize";
import {
  resolveCodeTaskSpecificRole,
  roleKindToDefaultRelated,
  type CodeTaskRoleKind,
} from "@/lib/prototype/codeTaskPromptRoleResolver";
import {
  filterPerTaskRequirementLines,
  filterPerTaskVerificationLines,
} from "@/lib/prototype/codeTaskPlanningDraftPolish";
import {
  evaluateCodeTaskPromptCollisionReadiness,
  mergePromptContextQualityWithCollisionReadiness,
} from "@/lib/prototype/codeTaskPromptQualityGate";
import { refineTargetUsersForRuntime, refineProblemToSolveForRuntime } from "@/lib/prototype/codeTaskRuntimePromptContextView";
import { formatTemplateLayoutSnippetForRole } from "@/lib/prototype/codeTaskTemplateLayoutDraft";
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
        .map((x) => sanitizePlanningPromptText(String(x ?? "").trim()))
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
  readonly templateId?: string;
} {
  const seed = parseImplementationSeedV1(state.implementationSeedV1);
  const organize = state.organizeContext;
  let serviceGoal: string | undefined;
  let problemToSolve: string | undefined;
  const targetUsers: string[] = [];
  let templateId: string | undefined;

  if (seed?.templateContext) {
    const tc = seed.templateContext;
    templateId = tc.templateId?.trim() || undefined;
    serviceGoal = sanitizePlanningPromptText(
      tc.description?.trim() || tc.templateNameKo?.trim() || "",
    );
    problemToSolve =
      templateId === "meeting-workspace"
        ? "녹취 업로드·변환·화자 분리·회의록 초안/요약·스크립트 확인을 한 화면에서 처리"
        : sanitizePlanningPromptText(
            tc.primarySections?.[0] ? String(tc.primarySections[0]).trim() : tc.templateNameKo?.trim() || "",
          );
    if (tc.navigationItems?.length) {
      targetUsers.push(...tc.navigationItems.slice(0, 3).map((x) => String(x).trim()).filter(Boolean));
    }
  }

  if (organize && typeof organize === "object") {
    const o = organize as Record<string, unknown>;
    if (!serviceGoal) {
      serviceGoal = sanitizePlanningPromptText(
        String(o.serviceSummary ?? o.productSummary ?? o.summary ?? "").trim(),
      );
    }
    if (!problemToSolve) {
      problemToSolve = sanitizePlanningPromptText(
        String(o.problemToSolve ?? o.userProblem ?? "").trim(),
      );
    }
  }

  const artifacts = Array.isArray(state.projectArtifacts)
    ? (state.projectArtifacts as ProjectArtifact[])
    : [];
  const featureSpec = artifacts.find((a) => a.type === "feature-spec");
  if (!serviceGoal && featureSpec?.title) {
    serviceGoal = sanitizePlanningPromptText(featureSpec.title.trim());
  }
  if (!problemToSolve && featureSpec?.content) {
    const first = featureSpec.content.split("\n").map((l) => l.trim()).find(Boolean);
    if (first) problemToSolve = sanitizePlanningPromptText(first.slice(0, 240));
  }

  return {
    serviceGoal: serviceGoal || undefined,
    problemToSolve: problemToSolve || undefined,
    targetUsers: uniq(targetUsers),
    templateId,
  };
}

function seedFlowContext(seed: ImplementationSeedV1, matchedFlows: readonly string[]): CodeTaskPromptContextV1["flowContext"] {
  const actors = uniq(seed.actorCapabilityMatrix.map((r) => r.actor));
  const flows = uniq(
    seed.processImplementationItems.flatMap((p) => [
      p.processName,
      ...(Array.isArray(p.actions) ? p.actions : []).slice(0, 2),
    ]),
  );
  const steps = uniq(seed.processImplementationItems.map((p) => p.processName));
  return {
    relatedActors: actors.slice(0, 6),
    relatedUserFlows: uniq([...matchedFlows, ...flows]).slice(0, 6),
    relatedServiceSteps: steps.slice(0, 6),
  };
}

function matchCodeTaskToSeed(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTitle?: string;
  readonly seed: ImplementationSeedV1;
}): {
  readonly features: readonly string[];
  readonly screens: readonly string[];
  readonly states: readonly string[];
  readonly flows: readonly string[];
} {
  const text = haystack(
    `${input.codeTask.title} ${input.codeTask.description} ${input.parentTitle ?? ""}`,
  );
  const features: string[] = [];
  const screens: string[] = [];
  const states: string[] = [];
  const flows: string[] = [];

  for (const f of input.seed.commonDetailFeatures) {
    const name = f.name.trim();
    if (!name) continue;
    if (matchesToken(text, name) || matchesToken(name, input.codeTask.title)) {
      features.push(name);
    }
  }
  for (const s of input.seed.screenImplementationItems) {
    const screenName = s.screenName.trim();
    if (matchesToken(text, screenName) || matchesToken(screenName, input.parentTitle ?? "")) {
      screens.push(screenName);
    }
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

function isCommonStateRole(roleKind: CodeTaskRoleKind): boolean {
  return (
    roleKind === "common_loading" ||
    roleKind === "common_error" ||
    roleKind === "common_empty" ||
    roleKind === "common_retry" ||
    roleKind === "common_permission" ||
    roleKind === "common_draft"
  );
}

function isScreenRole(roleKind: CodeTaskRoleKind): boolean {
  return roleKind === "screen_input" || roleKind === "screen_result" || roleKind === "screen_admin";
}

function isFeatureFlowRole(roleKind: CodeTaskRoleKind): boolean {
  return (
    roleKind === "feature_start" ||
    roleKind === "feature_input" ||
    roleKind === "feature_processing" ||
    roleKind === "feature_result"
  );
}

function isGenericRoleText(role: string): boolean {
  return /에 맞는 UI·상태·연동을 제공|기획 범위에 맞는 기능을 구현/.test(role);
}

function evaluateContextQuality(input: {
  readonly roleKind: CodeTaskRoleKind;
  readonly roleWarnings: readonly string[];
  readonly implementationContext: CodeTaskPromptContextV1["implementationContext"];
  readonly verificationContext: CodeTaskPromptContextV1["verificationContext"];
  readonly featureContext: CodeTaskPromptContextV1["featureContext"];
  readonly hasTemplateSnippet: boolean;
}): CodeTaskPromptContextV1["quality"] {
  const missing: string[] = [];
  const warnings = [...input.roleWarnings];

  const reqCount = input.implementationContext.requirements.length;
  const verCount =
    input.verificationContext.acceptanceCriteria.length +
    input.verificationContext.manualChecks.length;

  if (input.roleKind === "generic") warnings.push("generic_role");
  if (reqCount < 3) warnings.push("insufficient_requirements");
  if (verCount < 2) warnings.push("insufficient_verification_criteria");

  if (isCommonStateRole(input.roleKind)) {
    if (input.featureContext.relatedStates.length < 2) {
      missing.push("relatedStates");
      warnings.push("missing_related_state");
    }
    if (!input.implementationContext.expectedBehavior.length) {
      missing.push("expectedBehavior");
    }
  }

  if (input.roleKind === "mock_data") {
    const richness =
      input.featureContext.inputs.length +
      input.featureContext.outputs.length +
      input.featureContext.relatedFeatures.length;
    if (richness < 2) warnings.push("insufficient_mock_context");
  }

  const needsLinkage =
    isScreenRole(input.roleKind) ||
    isFeatureFlowRole(input.roleKind) ||
    isCommonStateRole(input.roleKind);

  if (needsLinkage && !input.featureContext.relatedFeatures.length) {
    missing.push("relatedData");
    warnings.push("missing_related_data");
  }

  if (needsLinkage && !input.featureContext.relatedScreens.length) {
    missing.push("relatedScreens");
    warnings.push("missing_related_screen");
  }

  if (needsLinkage && !input.featureContext.relatedStates.length) {
    missing.push("relatedStates");
    warnings.push("missing_related_state");
  }

  if (input.roleKind === "common_permission" && !input.featureContext.relatedScreens.length) {
    warnings.push("missing_related_screen");
  }

  if (!input.hasTemplateSnippet && input.roleKind !== "generic" && input.roleKind !== "mock_data" && input.roleKind !== "integration_wiring") {
    warnings.push("empty_template_context");
  }

  if (isGenericRoleText(input.implementationContext.intent)) {
    warnings.push("generic_role");
    missing.push("specificRole");
  }

  if (input.roleKind === "integration_wiring") {
    const reqHay = input.implementationContext.requirements.join("\n");
    const ready =
      /import/i.test(reqHay) &&
      /props|wiring/i.test(reqHay) &&
      /Preview/i.test(reqHay) &&
      !/반응형 3열 workspace shell/i.test(reqHay) &&
      input.implementationContext.requirements.length >= 3 &&
      input.verificationContext.acceptanceCriteria.length >= 2;
    return {
      ready,
      missing: ready ? uniq(missing) : uniq([...missing, "integration_task_not_final_wiring"]),
      warnings: uniq(warnings),
    };
  }

  const ready =
    input.roleKind !== "generic" &&
    !isGenericRoleText(input.implementationContext.intent) &&
    Boolean(input.implementationContext.intent.trim()) &&
    reqCount >= 3 &&
    verCount >= 2 &&
    !missing.length;

  return {
    ready,
    missing: uniq(missing),
    warnings: uniq(warnings),
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
  const parent = input.parentTask;
  const seed = input.seed;
  const parentTitle = parent?.title?.trim();
  const parentDescription = parent?.description?.trim();

  const roleResolved = resolveCodeTaskSpecificRole({
    codeTaskTitle: input.codeTask.title,
    codeTaskDescription: input.codeTask.description,
    parentTaskTitle: parentTitle,
    parentTaskDescription: parentDescription,
    requirements: input.codeTask.acceptanceCriteria,
    changeType: input.codeTask.changeType,
    templateContext: seed?.templateContext
      ? { templateId: seed.templateContext.templateId, templateNameKo: seed.templateContext.templateNameKo }
      : null,
  });

  const roleDefaults = roleKindToDefaultRelated({ roleKind: roleResolved.roleKind });
  const matched = seed
    ? matchCodeTaskToSeed({ codeTask: input.codeTask, parentTitle, seed })
    : { features: [], screens: [], states: [], flows: [] };

  let source: CodeTaskPromptContextV1["source"] = "heuristic_fallback";
  if (seed) source = "planning_artifacts";

  const rawTargetUsers = input.planningSummary.targetUsers.length
    ? input.planningSummary.targetUsers
    : seed
      ? uniq(seed.actorCapabilityMatrix.map((r) => r.actor)).slice(0, 4)
      : [];

  const flowContext = seed
    ? seedFlowContext(seed, matched.flows)
    : { relatedActors: [], relatedUserFlows: [], relatedServiceSteps: [] };

  const featureContext = {
    relatedFeatures: uniq([...roleDefaults.features, ...matched.features]).slice(0, 8),
    relatedScreens: uniq([...roleDefaults.screens, ...matched.screens]).slice(0, 8),
    relatedStates: uniq([...roleDefaults.states, ...matched.states]).slice(0, 10),
    inputs:
      roleResolved.roleKind === "mock_data"
        ? uniq(["회의 파일", "참여자", ...matched.features]).slice(0, 6)
        : [],
    outputs:
      roleResolved.roleKind === "mock_data"
        ? uniq(["스크립트", "요약", "진행 상태"]).slice(0, 6)
        : [],
  };

  const planningContext = {
    serviceGoal:
      input.planningSummary.serviceGoal ??
      (parentDescription ? sanitizePlanningPromptText(parentDescription.slice(0, 200)) : undefined),
    targetUsers: refineTargetUsersForRuntime({
      targetUsers: rawTargetUsers,
      relatedScreens: featureContext.relatedScreens,
    }),
    problemToSolve: refineProblemToSolveForRuntime({
      serviceGoal: input.planningSummary.serviceGoal,
      problemToSolve:
        input.planningSummary.problemToSolve ??
        (parentTitle ? sanitizePlanningPromptText(parentTitle) : undefined),
    }),
    businessGoal: parentTitle ? sanitizePlanningPromptText(parentTitle) : undefined,
  };

  const featureTemplate = resolveCodeTaskFeaturePromptTemplate({
    title: input.codeTask.title,
    description: input.codeTask.description,
    requirements: input.codeTask.acceptanceCriteria,
    changeType: input.codeTask.changeType,
    parentTitle,
    roleKind: roleResolved.roleKind,
  });

  const layoutSnippet = formatTemplateLayoutSnippetForRole({
    roleKind: roleResolved.roleKind,
    templateId: input.planningSummary.templateId ?? seed?.templateContext?.templateId,
  });

  const uniqueCriteria = filterPerTaskRequirementLines(
    uniq(
      input.codeTask.acceptanceCriteria.filter((c) => {
        const line = c.trim();
        if (!line) return false;
        if (/기획 산출물|공통 동작|기능 진입점|상태 전환|연동 지점/i.test(line)) return false;
        return true;
      }),
    ),
    roleResolved.roleKind,
  );

  const implementationContext =
    roleResolved.roleKind === "integration_wiring"
      ? {
          intent: sanitizePlanningPromptText(roleResolved.role),
          requirements: filterPerTaskRequirementLines(uniqueCriteria, "integration_wiring").slice(0, 9),
          constraints: uniq(input.codeTask.forbiddenPaths ?? []).slice(0, 8),
          expectedBehavior: [
            "기존 App Shell/Panel 구조를 유지하면서 screen/common/feature/data 결과물만 연결한다.",
          ],
          edgeCases: [],
        }
      : {
          intent: sanitizePlanningPromptText(roleResolved.role),
          requirements: filterPerTaskRequirementLines(
            uniq([...featureTemplate.implementationRequirements, ...uniqueCriteria]),
            roleResolved.roleKind,
          ).slice(0, 7),
          constraints: uniq(input.codeTask.forbiddenPaths ?? []).slice(0, 8),
          expectedBehavior: uniq([
            ...featureTemplate.implementationGoal,
            ...(isCommonStateRole(roleResolved.roleKind)
              ? [`${roleResolved.role} 연동 시 정상 화면으로 복귀 가능해야 한다.`]
              : []),
          ]).slice(0, 6),
          edgeCases: [],
        };

  const verificationContext =
    roleResolved.roleKind === "integration_wiring"
      ? {
          acceptanceCriteria: filterPerTaskVerificationLines(
            uniq(input.codeTask.verificationHints ?? []),
          ).slice(0, 6),
          manualChecks: [],
          regressionChecks: [],
        }
      : {
          acceptanceCriteria: filterPerTaskVerificationLines(
            uniq([...featureTemplate.verificationChecklist, ...uniqueCriteria]),
          ).slice(0, 5),
          manualChecks: uniq(input.codeTask.verificationHints ?? []).slice(0, 6),
          regressionChecks: [],
        };

  const seedWarnings = seed ? [] : ["implementationSeedV1"];
  const quality = mergePromptContextQualityWithCollisionReadiness({
    base: evaluateContextQuality({
      roleKind: roleResolved.roleKind,
      roleWarnings: [...roleResolved.warnings, ...seedWarnings],
      implementationContext,
      verificationContext,
      featureContext,
      hasTemplateSnippet: Boolean(layoutSnippet),
    }),
    collision: evaluateCodeTaskPromptCollisionReadiness({ codeTask: input.codeTask }),
  });

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
    quality,
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
    const parentTask = taskList?.tasks.find((t) => t.taskId === codeTask.parentTaskId) ?? null;
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
