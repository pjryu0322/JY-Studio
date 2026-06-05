import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskPromptContextV1 } from "@/lib/prototype/codeTaskPromptContext";
import {
  filterPerTaskRequirementLines,
  filterPerTaskVerificationLines,
} from "@/lib/prototype/codeTaskPlanningDraftPolish";
import { resolveCodeTaskFeaturePromptTemplate } from "@/lib/prototype/codeTaskPromptFeatureTemplates";
import {
  resolveCodeTaskSpecificRole,
  type CodeTaskRoleKind,
} from "@/lib/prototype/codeTaskPromptRoleResolver";
import { formatTemplateLayoutSnippetForRole } from "@/lib/prototype/codeTaskTemplateLayoutDraft";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

const DEFAULT_TARGET_USER =
  "회의 녹취를 업로드하고 회의록 초안·요약·스크립트를 확인하는 사용자" as const;

const DEFAULT_PROBLEM_TO_SOLVE =
  "업로드, STT 변환, 화자 분리, 초안 생성 과정의 진행 상태와 결과를 한 화면에서 명확히 확인하기 어렵다." as const;

const SCREEN_OR_AREA_USER_TOKENS =
  /^(워크스페이스|작업\s*공간|회의\s*목록|회의\s*파일|결과\s*패널|요약본|스크립트|참여자|참여자\s*목록|회의\s*파일\s*목록)$/i;

export const APP_SHELL_RUNTIME_REQUIREMENTS: readonly string[] = [
  "반응형 3열 workspace shell/container를 구현한다.",
  "좌열, 중앙, 우열 패널을 명확한 컴포넌트 단위로 분리한다.",
  "좌열에는 회의 파일/참여자 영역을 배치한다.",
  "중앙에는 작업 공간과 하단 입력줄을 배치한다.",
  "우열에는 결과 패널, 요약본/스크립트 탭, 초안 생성 타임라인을 배치한다.",
  "프레임 상단에는 변환 단계 칩 또는 진행 상태 영역을 배치한다.",
  "모바일에서는 주요 패널이 세로 스택 또는 탭 구조로 전환될 수 있어야 한다.",
  "공통 frame 안에서 입력/결과/상태 컴포넌트를 렌더링할 수 있게 한다.",
];

export const APP_SHELL_RUNTIME_VERIFICATION: readonly string[] = [
  "좌열/중앙/우열 패널이 렌더링된다.",
  "입력 화면과 결과 화면이 동일한 shell/container 안에서 배치될 수 있다.",
  "모바일 또는 좁은 화면에서 주요 패널이 깨지지 않는다.",
  "변환 단계 칩 또는 진행 상태 영역이 표시된다.",
];

const APP_SHELL_GENERIC_REQUIREMENT =
  /화면\s*컴포넌트\s*및\s*필요한\s*상태|정상\/예외\/로딩\s*상태\s*처리|기존\s*라우팅·레이아웃과\s*연동/i;

const APP_SHELL_GENERIC_VERIFICATION =
  /navigationItems|summaryCards|화면\s*진입|주요\s*플로우\s*확인|예외\s*상태\s*확인/i;

const GENERIC_RUNTIME_PHRASES: readonly RegExp[] = [
  /기획\s*산출물\s*기준으로\s*공통\s*동작/i,
  /기능\s*진입점,\s*상태\s*전환,\s*연동\s*지점/i,
  /프로세스\s*핵심\s*동작이\s*동선에\s*맞게/i,
  /^예외\/빈\s*상태가\s*처리/i,
  /주요\s*UI\s*영역이\s*표시/i,
  /샘플\s*데이터\s*기준으로\s*화면\s*상태/i,
];

export type CodeTaskRuntimePromptContextView = Readonly<{
  readonly codeTaskId: string;
  readonly roleKind: CodeTaskRoleKind;
  readonly role: string;

  readonly planningContext: Readonly<{
    readonly serviceGoal?: string;
    readonly targetUsers: readonly string[];
    readonly problemToSolve?: string;
    readonly relatedUserFlows: readonly string[];
  }>;

  readonly relatedContext: Readonly<{
    readonly screens: readonly string[];
    readonly states: readonly string[];
    readonly data: readonly string[];
    readonly templateAreas: readonly string[];
  }>;

  readonly implementation: Readonly<{
    readonly scope: readonly string[];
    readonly intent: readonly string[];
    readonly requirements: readonly string[];
    readonly expectedBehavior: readonly string[];
    readonly constraints: readonly string[];
  }>;

  readonly verification: Readonly<{
    readonly checks: readonly string[];
    readonly regressionChecks: readonly string[];
  }>;

  readonly quality: Readonly<{
    readonly ready: boolean;
    readonly missing: readonly string[];
    readonly warnings: readonly string[];
  }>;
}>;

function uniq(lines: readonly string[]): string[] {
  return [...new Set(lines.map((l) => String(l).trim()).filter(Boolean))];
}

function isGenericRuntimeLine(line: string): boolean {
  return GENERIC_RUNTIME_PHRASES.some((p) => p.test(line.trim()));
}

function normalizeComparable(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function isWeakTargetUserLabel(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  if (SCREEN_OR_AREA_USER_TOKENS.test(t)) return true;
  if (/^참여자$/i.test(t)) return true;
  return t.length < 5;
}

export function refineTargetUsersForRuntime(input: {
  readonly targetUsers: readonly string[];
  readonly relatedScreens: readonly string[];
}): readonly string[] {
  const users = input.targetUsers.map((u) => u.trim()).filter(Boolean);
  const kept = users.filter((u) => !isWeakTargetUserLabel(u));
  if (kept.length >= 2) return kept;
  if (kept.length === 1 && kept[0]!.length >= 10) return kept;
  if (users.length >= 2 && users.every((u) => SCREEN_OR_AREA_USER_TOKENS.test(u) || /^참여자$/i.test(u))) {
    return [DEFAULT_TARGET_USER];
  }
  if (kept.length === 0 || users.some((u) => /^참여자$/i.test(u.trim()))) {
    return [DEFAULT_TARGET_USER];
  }
  return kept.length ? kept : [DEFAULT_TARGET_USER];
}

export function refineProblemToSolveForRuntime(input: {
  readonly serviceGoal?: string;
  readonly problemToSolve?: string;
}): string {
  const goal = String(input.serviceGoal ?? "").trim();
  const problem = String(input.problemToSolve ?? "").trim();
  if (!problem) return DEFAULT_PROBLEM_TO_SOLVE;
  if (goal && normalizeComparable(goal) === normalizeComparable(problem)) {
    return DEFAULT_PROBLEM_TO_SOLVE;
  }
  if (
    goal &&
    problem.length < 80 &&
    (problem.includes("한 화면에서 처리") || problem.includes("녹취 업로드·변환"))
  ) {
    return DEFAULT_PROBLEM_TO_SOLVE;
  }
  return problem;
}

function templateAreaLines(roleKind: CodeTaskRoleKind, templateId?: string): string[] {
  const snippet = formatTemplateLayoutSnippetForRole({ roleKind, templateId });
  if (!snippet?.trim()) return [];
  return snippet
    .split("\n")
    .map((l) => l.trim().replace(/^-\s*/, ""))
    .filter((l) => l && !/^관련\s*템플릿/i.test(l));
}

function shouldUseContextPrimary(
  promptContext: CodeTaskPromptContextV1 | null | undefined,
  requirementsCount: number,
  checksCount: number,
): boolean {
  if (!promptContext) return false;
  if (requirementsCount >= 3 && checksCount >= 2) return true;
  if (promptContext.quality.ready && requirementsCount >= 2 && checksCount >= 1) return true;
  return false;
}

function fallbackRequirements(
  codeTask: ImplementationCodeTaskV1,
  parentTask: ImplementationTaskV1 | null | undefined,
  roleKind: CodeTaskRoleKind,
): string[] {
  const tpl = resolveCodeTaskFeaturePromptTemplate({
    title: codeTask.title,
    description: codeTask.description,
    requirements: codeTask.acceptanceCriteria,
    changeType: codeTask.changeType,
    parentTitle: parentTask?.title,
    roleKind,
  });
  return filterPerTaskRequirementLines(
    uniq([...tpl.implementationRequirements, ...codeTask.acceptanceCriteria]),
    roleKind,
  ).filter((l) => !isGenericRuntimeLine(l));
}

function fallbackVerification(
  codeTask: ImplementationCodeTaskV1,
  parentTask: ImplementationTaskV1 | null | undefined,
  roleKind: CodeTaskRoleKind,
): string[] {
  const tpl = resolveCodeTaskFeaturePromptTemplate({
    title: codeTask.title,
    description: codeTask.description,
    requirements: codeTask.acceptanceCriteria,
    changeType: codeTask.changeType,
    parentTitle: parentTask?.title,
    roleKind,
  });
  return filterPerTaskVerificationLines(
    uniq([...tpl.verificationChecklist, ...codeTask.acceptanceCriteria]),
  ).filter((l) => !isGenericRuntimeLine(l));
}

export function buildCodeTaskRuntimePromptContextView(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly templateId?: string;
}): CodeTaskRuntimePromptContextView {
  const roleResolved = resolveCodeTaskSpecificRole({
    codeTaskTitle: input.codeTask.title,
    codeTaskDescription: input.codeTask.description,
    parentTaskTitle: input.parentTask?.title,
    parentTaskDescription: input.parentTask?.description,
    requirements: input.codeTask.acceptanceCriteria,
    changeType: input.codeTask.changeType,
  });

  const ctx = input.promptContext;
  const pc = ctx?.planningContext;
  const serviceGoal = pc?.serviceGoal?.trim() || undefined;
  const relatedScreens = uniq([
    ...(ctx?.featureContext.relatedScreens ?? []),
    ...(roleResolved.roleKind === "screen_admin" ? ["관리 화면"] : []),
  ]);
  const targetUsers = refineTargetUsersForRuntime({
    targetUsers: pc?.targetUsers ?? [],
    relatedScreens,
  });
  const problemToSolve = refineProblemToSolveForRuntime({
    serviceGoal,
    problemToSolve: pc?.problemToSolve,
  });

  const templateAreas = templateAreaLines(roleResolved.roleKind, input.templateId);

  let requirements = filterPerTaskRequirementLines(
    uniq(ctx?.implementationContext.requirements ?? []),
    roleResolved.roleKind,
  ).filter((l) => !isGenericRuntimeLine(l));

  let checks = filterPerTaskVerificationLines(
    uniq([
      ...(ctx?.verificationContext.acceptanceCriteria ?? []),
      ...(ctx?.verificationContext.manualChecks ?? []),
    ]),
  ).filter((l) => !isGenericRuntimeLine(l));

  const useContext = shouldUseContextPrimary(ctx, requirements.length, checks.length);

  if (!useContext || requirements.length < 3) {
    requirements = fallbackRequirements(input.codeTask, input.parentTask, roleResolved.roleKind);
  }
  if (roleResolved.roleKind === "app_shell") {
    const hasGeneric = requirements.some((r) => APP_SHELL_GENERIC_REQUIREMENT.test(r));
    if (hasGeneric || requirements.length < 5) {
      requirements = [...APP_SHELL_RUNTIME_REQUIREMENTS];
    }
  }
  if (!useContext || checks.length < 2) {
    checks = fallbackVerification(input.codeTask, input.parentTask, roleResolved.roleKind);
  }
  if (roleResolved.roleKind === "app_shell") {
    const weakChecks =
      checks.length < 3 || checks.some((c) => APP_SHELL_GENERIC_VERIFICATION.test(c));
    if (weakChecks) {
      checks = [...APP_SHELL_RUNTIME_VERIFICATION];
    }
  }

  const intent = uniq([
    roleResolved.role,
    ...(ctx?.implementationContext.intent ? [ctx.implementationContext.intent] : []),
  ]).filter((l) => !isGenericRuntimeLine(l) && !/에 맞는 UI·상태·연동/.test(l));

  const scope = uniq([
    roleResolved.role,
    ...templateAreas.slice(0, 4),
    ...(roleResolved.roleKind === "app_shell"
      ? [
          "선택된 템플릿의 전체 IA, 공통 레이아웃, 컨테이너, 주요 패널 구조를 구현한다.",
        ]
      : []),
  ]).slice(0, 6);

  const expectedBehavior = uniq(ctx?.implementationContext.expectedBehavior ?? []).filter(
    (l) => !isGenericRuntimeLine(l),
  );

  return {
    codeTaskId: input.codeTask.codeTaskId,
    roleKind: roleResolved.roleKind,
    role: roleResolved.role,
    planningContext: {
      serviceGoal,
      targetUsers,
      problemToSolve,
      relatedUserFlows: (ctx?.flowContext.relatedUserFlows ?? []).slice(0, 4),
    },
    relatedContext: {
      screens: relatedScreens,
      states: uniq(ctx?.featureContext.relatedStates ?? roleKindToStates(roleResolved.roleKind)),
      data: uniq(ctx?.featureContext.relatedFeatures ?? []),
      templateAreas,
    },
    implementation: {
      scope,
      intent: intent.slice(0, 3),
      requirements: requirements.slice(0, roleResolved.roleKind === "app_shell" ? 8 : 7),
      expectedBehavior: expectedBehavior.slice(0, 4),
      constraints: uniq(ctx?.implementationContext.constraints ?? input.codeTask.forbiddenPaths ?? []).slice(
        0,
        6,
      ),
    },
    verification: {
      checks: checks.slice(0, 5),
      regressionChecks: [],
    },
    quality: {
      ready: ctx?.quality.ready ?? false,
      missing: ctx?.quality.missing ?? [],
      warnings: ctx?.quality.warnings ?? [],
    },
  };
}

function roleKindToStates(roleKind: CodeTaskRoleKind): string[] {
  switch (roleKind) {
    case "common_loading":
      return ["loading", "uploading"];
    case "common_retry":
      return ["error", "retrying"];
    case "screen_result":
    case "feature_result":
      return ["success", "empty", "loading", "error"];
    default:
      return [];
  }
}

/** 2단계 prompt에서 context view 우선 사용 여부 */
export function shouldPreferRuntimeContextView(view: CodeTaskRuntimePromptContextView): boolean {
  return view.implementation.requirements.length >= 3 && view.verification.checks.length >= 2;
}
