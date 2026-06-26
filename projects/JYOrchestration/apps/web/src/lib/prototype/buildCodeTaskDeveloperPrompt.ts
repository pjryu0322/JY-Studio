import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskPromptContextV1 } from "@/lib/prototype/codeTaskPromptContext";
import {
  buildCodeTaskRuntimePromptContextView,
  shouldPreferRuntimeContextView,
} from "@/lib/prototype/codeTaskRuntimePromptContextView";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  buildCodeTaskPromptTargetContext,
  GENERATED_PROJECT_PROBE_PATHS,
  isPlatformInternalPath,
  sanitizeCandidatePathsForTargetRepo,
  type CodeTaskPromptTargetRepoKind,
} from "@/lib/prototype/codeTaskPromptPathPolicy";
import {
  buildCodeTaskFileBoundaryPromptSections,
  inferCodeTaskFileBoundary,
} from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { evaluateStageTwoDeveloperPromptReadiness } from "@/lib/prototype/codeTaskDeveloperPromptQualityGate";
import {
  buildGeneratedStageTwoDeveloperPrompt,
  stageTwoDeveloperPromptInputsPresent,
  type GeneratedCodeTaskPromptV1,
} from "@/lib/prototype/generatedCodeTaskPrompt";
import type { CodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { CodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { buildCodeTaskWorkBranch, resolveCodeTaskWorkBranchForTask, resolveCodeTaskBaseBranchForTask } from "@/lib/prototype/taskCursorExecution";
import {
  buildCodeTaskBranchPlanPromptSections,
  parseCodeTaskBranchPlanV1,
} from "@/lib/prototype/implementationBranchPlan";
import {
  buildDeveloperPromptSearchScopeSections,
  buildRouteEntryForbiddenRuleLines,
  buildWorkResultReportFormatSections,
  requiresRouteEntryGuardInPrompt,
} from "@/lib/prototype/codeTaskDeveloperPromptTemplate";
import type { CodeTaskDeveloperPromptAugmentation } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import { finalizeCodeTaskDeveloperPromptWithAugmentation } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";

export type BuildCodeTaskDeveloperPromptResult = Readonly<{
  readonly prompt: string;
  readonly removedCandidatePaths: readonly string[];
  readonly warnings: readonly string[];
}>;

const GENERATED_BANNED_SUBSTRINGS = [
  "jyorchestration",
  "jygallery",
  "jyaccount",
  "chunk studio",
  "chunk-studio",
  "projects/jyorchestration",
  "stage1/stage2/env_test",
  "플랫폼 소스",
  "플랫폼 허용",
  "모노레포",
] as const;

function lineContainsGeneratedBannedText(line: string): boolean {
  const lower = line.toLowerCase();
  return GENERATED_BANNED_SUBSTRINGS.some((s) => lower.includes(s));
}

function sanitizeLinesForGeneratedProject(lines: readonly string[]): string[] {
  return lines
    .map((l) => String(l ?? "").trim())
    .filter(Boolean)
    .filter((line) => !lineContainsGeneratedBannedText(line))
    .filter((line) => !isPlatformInternalPath(line));
}

function dedupeBulletLines(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.startsWith("- ") ? line : `- ${line}`;
    const key = bullet.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(bullet);
  }
  return out;
}

function resolveGeneratedProjectProbePathLines(safeCandidatePaths: readonly string[]): string[] {
  const globs = [...GENERATED_PROJECT_PROBE_PATHS];
  const candidates = safeCandidatePaths.map((p) => p.trim()).filter(Boolean);
  const narrowOnly =
    candidates.length > 0 &&
    candidates.length <= 2 &&
    candidates.every((p) => !p.includes("*"));
  if (narrowOnly || candidates.length === 0) {
    return globs.map((p) => `- ${p}`);
  }
  const merged = [...new Set([...globs, ...candidates])];
  return merged.map((p) => `- ${p}`);
}

function buildPlanningContextSectionsFromView(
  view: ReturnType<typeof buildCodeTaskRuntimePromptContextView>,
): string[] {
  const lines: string[] = [];
  const planningBullets: string[] = [];
  const pc = view.planningContext;
  if (pc.serviceGoal) planningBullets.push(`서비스 목적: ${pc.serviceGoal}`);
  if (pc.targetUsers.length) planningBullets.push(`핵심 사용자: ${pc.targetUsers.join(", ")}`);
  if (pc.problemToSolve) planningBullets.push(`해결하려는 문제: ${pc.problemToSolve}`);
  if (pc.relatedUserFlows.length) {
    planningBullets.push(`관련 사용자 흐름: ${pc.relatedUserFlows.join(", ")}`);
  }
  if (planningBullets.length) {
    lines.push("## 기획 맥락", ...planningBullets.map((b) => `- ${b}`), "");
  }

  const roleBullets: string[] = [`역할: ${view.role}`];
  const rc = view.relatedContext;
  if (rc.screens.length) roleBullets.push(`관련 화면: ${rc.screens.join(", ")}`);
  if (rc.states.length) roleBullets.push(`관련 상태: ${rc.states.join(", ")}`);
  if (rc.data.length) roleBullets.push(`관련 데이터: ${rc.data.join(", ")}`);
  if (rc.templateAreas.length) {
    roleBullets.push(`관련 템플릿 영역: ${rc.templateAreas.slice(0, 3).join(" · ")}`);
  }
  if (view.implementation.intent.length) {
    for (const item of view.implementation.intent.slice(0, 2)) {
      if (item !== view.role) roleBullets.push(item);
    }
  }

  lines.push("## 이번 CodeTask의 역할", ...roleBullets.map((b) => `- ${b}`), "");
  return lines;
}

function buildGeneratedProjectPrompt(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly target: ReturnType<typeof buildCodeTaskPromptTargetContext>;
  readonly sanitizedCandidates: ReturnType<typeof sanitizeCandidatePathsForTargetRepo>;
  readonly templateId?: string;
}): string {
  const { codeTask, target, sanitizedCandidates } = input;
  const view = buildCodeTaskRuntimePromptContextView({
    codeTask,
    parentTask: input.parentTask,
    promptContext: input.promptContext,
    templateId: input.templateId,
  });

  const preferContext = shouldPreferRuntimeContextView(view);

  const implementationScope = dedupeBulletLines(
    sanitizeLinesForGeneratedProject(view.implementation.scope),
  );

  const implementationRequirements = dedupeBulletLines(
    sanitizeLinesForGeneratedProject(view.implementation.requirements),
  );

  const verificationChecklist = dedupeBulletLines(
    sanitizeLinesForGeneratedProject(view.verification.checks),
  );

  if (!preferContext && implementationRequirements.length < 3) {
    // view builder already applied template fallback; keep as-is
  }

  const probePaths = resolveGeneratedProjectProbePathLines(
    sanitizedCandidates.safeCandidatePaths,
  );

  const boundary =
    parseCodeTaskFileBoundaryV1(codeTask.fileBoundary) ??
    inferCodeTaskFileBoundary({ codeTask, parentTask: input.parentTask ?? null });
  const branchPlan = parseCodeTaskBranchPlanV1(codeTask.branchPlan);
  const boundarySections = buildCodeTaskFileBoundaryPromptSections(
    boundary,
    branchPlan?.branchGroup,
  );
  const routeEntryGuard = requiresRouteEntryGuardInPrompt({
    branchGroup: branchPlan?.branchGroup,
    ownedFiles: boundary?.ownedFiles,
  });

  const sections = [
    "# CodeTask 개발 요청",
    "",
    "## 작업 저장소",
    `- 작업 대상 저장소: \`${target.repoFullName}\``,
    `- base branch: \`${target.baseBranch}\``,
    `- work branch: \`${target.workBranch}\``,
    "- 이 저장소 밖의 파일은 수정하지 않는다.",
    "- PR 생성·merge는 하지 않는다. commit 후 work branch에 push만 한다.",
    "",
    "## 작업 목표",
    codeTask.title.trim(),
    "",
    ...buildCodeTaskBranchPlanPromptSections(codeTask.branchPlan),
    ...buildPlanningContextSectionsFromView(view),
    "## 구현 범위",
    ...(implementationScope.length
      ? implementationScope
      : [`- ${view.role}`]),
    "",
    "## 구현 요구사항",
    ...implementationRequirements,
    "",
    ...boundarySections,
    ...buildDeveloperPromptSearchScopeSections(probePaths, {
      includeRouteEntryFrameworkCheck: routeEntryGuard,
    }),
    "",
    "## 검증 기준",
    ...verificationChecklist,
    "",
    ...buildWorkResultReportFormatSections({ requireRouteEntryDecision: routeEntryGuard }),
    "",
    "## 금지사항",
    ...target.forbiddenRules.map((r) => `- ${r}`),
    ...(routeEntryGuard ? buildRouteEntryForbiddenRuleLines().map((r) => r) : []),
    "",
    "## 완료 기준",
    "- 요구사항을 충족하는 코드 변경",
    "- 변경 후 commit 생성",
    `- \`${target.workBranch}\` branch에 push`,
    "- push 후 GitHub에서 branch head commit 확인 가능",
    "- 코드 변경이 불필요한 경우 noCodeChange 근거를 작업 결과 보고 형식에 기록",
  ];

  return sections.join("\n").trim();
}

function buildPlatformProjectPrompt(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly target: ReturnType<typeof buildCodeTaskPromptTargetContext>;
  readonly sanitizedCandidates: ReturnType<typeof sanitizeCandidatePathsForTargetRepo>;
}): string {
  const { codeTask, target, sanitizedCandidates } = input;
  const candidateSection =
    sanitizedCandidates.safeCandidatePaths.length > 0
      ? sanitizedCandidates.safeCandidatePaths.map((f) => `- ${f}`)
      : ["- (후보 없음 — 관련 파일을 스스로 탐색)"];

  const sections = [
    "# CodeTask 개발 요청",
    "",
    "## 작업 저장소",
    `- 작업 대상 저장소: \`${target.repoFullName}\``,
    `- base branch: \`${target.baseBranch}\``,
    `- work branch: \`${target.workBranch}\``,
    "- 이 저장소 밖의 파일은 수정하지 않는다.",
    "- PR 생성·merge는 하지 않는다. commit 후 work branch에 push만 한다.",
    "",
    "## 작업 목표",
    codeTask.title.trim(),
    ...(codeTask.description.trim() ? ["", codeTask.description.trim()] : []),
    "",
    "## 구현 범위",
    `- 변경 유형: ${codeTask.changeType}`,
    "",
    "## 수정 대상 탐색 기준",
    "- 대상 저장소 내부에서 관련 파일을 탐색한다.",
    "- 우선 탐색 경로:",
    ...candidateSection,
    "",
    "## 구현 요구사항",
    ...(codeTask.acceptanceCriteria.length
      ? codeTask.acceptanceCriteria.map((c) => `- ${c}`)
      : ["- acceptance criteria를 충족할 것"]),
    "",
    "## 검증 기준",
    ...(codeTask.verificationHints.length
      ? codeTask.verificationHints.map((h) => `- ${h}`)
      : ["- 로컬 build/test 후 동작 확인"]),
    ...buildCodeTaskFileBoundaryPromptSections(
      parseCodeTaskFileBoundaryV1(codeTask.fileBoundary) ??
        inferCodeTaskFileBoundary({ codeTask, parentTask: input.parentTask ?? null }),
    ),
    ...buildCodeTaskBranchPlanPromptSections(codeTask.branchPlan),
    "",
    "## 금지사항",
    ...target.forbiddenRules.map((p) => `- ${p}`),
    "- 무관한 대규모 리팩터링 금지",
    "",
    "## 완료 기준",
    "- 요구사항을 충족하는 코드 변경",
    "- 변경 후 commit 생성",
    `- \`${target.workBranch}\` branch에 push`,
    "- push 후 GitHub에서 branch head commit 확인 가능",
  ];

  return sections.filter((line) => line !== undefined).join("\n").trim();
}

export function buildCodeTaskDeveloperPrompt(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly targetRepoKind?: CodeTaskPromptTargetRepoKind;
}): string {
  return buildCodeTaskDeveloperPromptDetailed(input).prompt;
}

export function buildCodeTaskDeveloperPromptDetailed(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly targetRepoKind?: CodeTaskPromptTargetRepoKind;
  readonly templateId?: string;
  readonly developerPromptAugmentation?: CodeTaskDeveloperPromptAugmentation | null;
}): BuildCodeTaskDeveloperPromptResult {
  const repoKind = input.targetRepoKind ?? "generated_project";
  const repoFullName = input.targetRepository.repoFullName.trim();
  const workBranch = resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask });
  const baseBranchForPrompt =
    input.codeTask.branchPlan?.baseBranch?.trim() || input.baseBranch;

  const rawCandidates = [
    ...(input.codeTask.candidateFiles ?? []),
    ...(input.codeTask.candidateFileHints ?? []),
  ].filter(Boolean);

  const sanitized = sanitizeCandidatePathsForTargetRepo({
    candidatePaths: rawCandidates,
    targetRepoFullName: repoFullName,
    targetRepoKind: repoKind,
  });

  const target = buildCodeTaskPromptTargetContext({
    repoFullName,
    baseBranch: baseBranchForPrompt,
    workBranch,
    repoKind,
    allowedPathGlobs: input.allowedPathGlobs,
  });

  const prompt = finalizeCodeTaskDeveloperPromptWithAugmentation({
    basePrompt:
      repoKind === "generated_project"
        ? buildGeneratedProjectPrompt({
            codeTask: input.codeTask,
            parentTask: input.parentTask,
            promptContext: input.promptContext,
            target,
            sanitizedCandidates: sanitized,
            templateId: input.templateId,
          })
        : buildPlatformProjectPrompt({
            codeTask: input.codeTask,
            parentTask: input.parentTask,
            target,
            sanitizedCandidates: sanitized,
          }),
    augmentation: input.developerPromptAugmentation,
  });

  return {
    prompt,
    removedCandidatePaths: sanitized.removedCandidatePaths,
    warnings: sanitized.warnings,
  };
}

export function buildStageTwoCodeTaskDeveloperPrompt(input: {
  readonly projectId: string;
  readonly targetRepository: ProjectTargetRepository;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly promptContext: CodeTaskPromptContextV1;
  readonly branchPlan: CodeTaskBranchPlanV1;
  readonly fileBoundary: CodeTaskFileBoundaryV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly allowedPathGlobs?: readonly string[];
  readonly templateId?: string;
  readonly nowIso: string;
  readonly developerPromptAugmentation?: CodeTaskDeveloperPromptAugmentation | null;
}): GeneratedCodeTaskPromptV1 {
  void input.projectId;
  void input.nowIso;

  const missingInputs = stageTwoDeveloperPromptInputsPresent({
    branchPlan: input.branchPlan,
    fileBoundary: input.fileBoundary,
    promptContext: input.promptContext,
  });
  if (missingInputs.length) {
    return buildGeneratedStageTwoDeveloperPrompt({
      codeTaskId: input.codeTask.codeTaskId,
      title: input.codeTask.title,
      content: "",
      quality: {
        ready: false,
        readiness: "blocked_incomplete_inputs",
        missing: missingInputs,
        warnings: [],
      },
    });
  }

  const codeTaskWithPlan = {
    ...input.codeTask,
    branchPlan: input.branchPlan,
    fileBoundary: input.fileBoundary,
  };

  const built = buildCodeTaskDeveloperPromptDetailed({
    codeTask: codeTaskWithPlan,
    parentTask: input.parentTask,
    promptContext: input.promptContext,
    targetRepository: input.targetRepository,
    baseBranch: resolveCodeTaskBaseBranchForTask({ codeTask: codeTaskWithPlan }),
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoKind: "generated_project",
    templateId: input.templateId,
    developerPromptAugmentation: input.developerPromptAugmentation,
  });

  const quality = evaluateStageTwoDeveloperPromptReadiness({
    prompt: built.prompt,
    codeTask: codeTaskWithPlan,
    promptContextPresent: true,
    targetRepoFullName: input.targetRepository.repoFullName,
    fallbackBaseBranch: input.targetRepository.defaultBranch,
  });

  return buildGeneratedStageTwoDeveloperPrompt({
    codeTaskId: input.codeTask.codeTaskId,
    title: input.codeTask.title,
    content: built.prompt,
    quality,
  });
}
