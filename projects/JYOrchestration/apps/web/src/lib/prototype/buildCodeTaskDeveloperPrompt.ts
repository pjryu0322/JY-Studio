import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveCodeTaskFeaturePromptTemplate } from "@/lib/prototype/codeTaskPromptFeatureTemplates";
import type { CodeTaskPromptContextV1 } from "@/lib/prototype/codeTaskPromptContext";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  buildCodeTaskPromptTargetContext,
  GENERATED_PROJECT_PROBE_PATHS,
  isPlatformInternalPath,
  sanitizeCandidatePathsForTargetRepo,
  type CodeTaskPromptTargetRepoKind,
} from "@/lib/prototype/codeTaskPromptPathPolicy";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";

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

function buildPlanningContextSections(promptContext?: CodeTaskPromptContextV1 | null): string[] {
  if (!promptContext) return [];
  const lines: string[] = [];
  const pc = promptContext.planningContext;
  const planningBullets: string[] = [];
  if (pc.serviceGoal) planningBullets.push(`서비스 목적: ${pc.serviceGoal}`);
  if (pc.targetUsers.length) planningBullets.push(`핵심 사용자: ${pc.targetUsers.join(", ")}`);
  if (pc.problemToSolve) planningBullets.push(`해결하려는 문제: ${pc.problemToSolve}`);
  const flows = promptContext.flowContext.relatedUserFlows.slice(0, 4);
  if (flows.length) planningBullets.push(`관련 사용자 흐름: ${flows.join(", ")}`);

  if (planningBullets.length) {
    lines.push("## 기획 맥락", ...planningBullets.map((b) => `- ${b}`), "");
  }

  const roleBullets: string[] = [];
  const feat = [
    ...promptContext.featureContext.relatedFeatures,
    ...promptContext.featureContext.relatedScreens,
    ...promptContext.featureContext.relatedStates,
  ].slice(0, 4);
  if (feat.length) roleBullets.push(`이 CodeTask가 담당하는 기능/상태: ${feat.join(", ")}`);
  if (promptContext.implementationContext.intent) {
    roleBullets.push(promptContext.implementationContext.intent);
  }
  const expected = promptContext.implementationContext.expectedBehavior.slice(0, 2);
  if (expected.length) roleBullets.push(`기대 동작: ${expected.join(" / ")}`);
  const screens = promptContext.featureContext.relatedScreens.slice(0, 3);
  if (screens.length) roleBullets.push(`연결되어야 하는 화면/흐름: ${screens.join(", ")}`);

  if (roleBullets.length) {
    lines.push("## 이번 CodeTask의 역할", ...roleBullets.map((b) => `- ${b}`), "");
  }
  return lines;
}

function buildGeneratedProjectPrompt(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly target: ReturnType<typeof buildCodeTaskPromptTargetContext>;
  readonly sanitizedCandidates: ReturnType<typeof sanitizeCandidatePathsForTargetRepo>;
}): string {
  const { codeTask, target, sanitizedCandidates } = input;
  const template = resolveCodeTaskFeaturePromptTemplate({
    title: codeTask.title,
    description: codeTask.description,
    requirements: codeTask.acceptanceCriteria,
    changeType: codeTask.changeType,
  });

  const extraAcceptance = sanitizeLinesForGeneratedProject(codeTask.acceptanceCriteria).filter(
    (line) =>
      !template.implementationRequirements.some(
        (req) => req.toLowerCase() === line.replace(/^-\s*/, "").toLowerCase(),
      ),
  );

  const implementationRequirements = dedupeBulletLines([
    ...template.implementationRequirements.map((r) => `- ${r}`),
    ...extraAcceptance.map((c) => (c.startsWith("- ") ? c : `- ${c}`)),
  ]);

  const verificationChecklist = dedupeBulletLines([
    ...template.verificationChecklist.map((v) => `- ${v}`),
    "- 대상 저장소 루트에서 package.json scripts를 확인한다.",
    "- 가능한 경우 build/test/lint 중 존재하는 명령을 실행한다.",
    "- 명령이 없으면 수정 파일과 화면 동작 기준으로 자체 검증한다.",
  ]);

  const probePaths =
    sanitizedCandidates.safeCandidatePaths.length > 0
      ? sanitizedCandidates.safeCandidatePaths.map((p) => `- ${p}`)
      : GENERATED_PROJECT_PROBE_PATHS.map((p) => `- ${p}`);

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
    ...buildPlanningContextSections(input.promptContext),
    "## 구현 범위",
    ...template.implementationGoal.map((g) => `- ${g}`),
    "",
    "## 구현 요구사항",
    ...implementationRequirements,
    "",
    "## 수정 대상 탐색 기준",
    "- 대상 저장소 내부에서 관련 화면, 컴포넌트, 상태 모듈을 탐색한다.",
    "- 우선 탐색 경로:",
    ...probePaths,
    "- 실제 저장소 구조에 맞춰 최소 범위만 수정한다.",
    "",
    "## 검증 기준",
    ...verificationChecklist,
    "",
    "## 금지사항",
    ...target.forbiddenRules.map((r) => `- ${r}`),
    "",
    "## 완료 기준",
    "- 요구사항을 충족하는 코드 변경",
    "- 변경 후 commit 생성",
    `- \`${target.workBranch}\` branch에 push`,
    "- push 후 GitHub에서 branch head commit 확인 가능",
    "- 코드 변경이 불필요한 경우 noCodeChange 근거를 명확히 기록",
    "",
    "## 참조 ID",
    `- Process Task: ${codeTask.parentTaskId}`,
    `- CodeTask: ${codeTask.codeTaskId}`,
  ];

  return sections.join("\n").trim();
}

function buildPlatformProjectPrompt(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly target: ReturnType<typeof buildCodeTaskPromptTargetContext>;
  readonly sanitizedCandidates: ReturnType<typeof sanitizeCandidatePathsForTargetRepo>;
}): string {
  const { codeTask, parentTask, target, sanitizedCandidates } = input;
  const parentTitle = parentTask?.title?.trim() || codeTask.parentTaskId;
  const candidateSection =
    sanitizedCandidates.safeCandidatePaths.length > 0
      ? sanitizedCandidates.safeCandidatePaths.map((f) => `- ${f}`)
      : ["- (후보 없음 — 관련 파일을 스스로 탐색)"];

  const sections = [
    "# CodeTask 개발 요청",
    "",
    "## Process Task",
    `- ID: ${codeTask.parentTaskId}`,
    `- 제목: ${parentTitle}`,
    parentTask?.description?.trim() ? `- 설명: ${parentTask.description.trim()}` : "",
    "",
    "## CodeTask",
    `- ID: ${codeTask.codeTaskId}`,
    `- 제목: ${codeTask.title}`,
    `- 설명: ${codeTask.description.trim()}`,
    `- 변경 유형: ${codeTask.changeType}`,
    "",
    "## 수정 대상 파일 후보",
    ...candidateSection,
    "",
    "## 구현 요구사항",
    ...(codeTask.acceptanceCriteria.length
      ? codeTask.acceptanceCriteria.map((c) => `- ${c}`)
      : ["- acceptance criteria를 충족할 것"]),
    "",
    "## 검증 힌트",
    ...(codeTask.verificationHints.length
      ? codeTask.verificationHints.map((h) => `- ${h}`)
      : ["- 로컬 build/test 후 동작 확인"]),
    "",
    "## 금지사항",
    ...target.forbiddenRules.map((p) => `- ${p}`),
    "- 무관한 대규모 리팩터링 금지",
    "",
    "## GitHub 정책",
    `- 저장소: ${target.repoFullName}`,
    `- base branch: ${target.baseBranch}`,
    `- work branch: ${target.workBranch}`,
    "",
    "## 허용 경로",
    ...target.allowedPathGlobs.map((g) => `- ${g}`),
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
}): BuildCodeTaskDeveloperPromptResult {
  const repoKind = input.targetRepoKind ?? "generated_project";
  const repoFullName = input.targetRepository.repoFullName.trim();
  const workBranch = buildCodeTaskWorkBranch(input.codeTask.codeTaskId);

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
    baseBranch: input.baseBranch,
    workBranch,
    repoKind,
    allowedPathGlobs: input.allowedPathGlobs,
  });

  const prompt =
    repoKind === "generated_project"
      ? buildGeneratedProjectPrompt({
          codeTask: input.codeTask,
          parentTask: input.parentTask,
          promptContext: input.promptContext,
          target,
          sanitizedCandidates: sanitized,
        })
      : buildPlatformProjectPrompt({
          codeTask: input.codeTask,
          parentTask: input.parentTask,
          target,
          sanitizedCandidates: sanitized,
        });

  return {
    prompt,
    removedCandidatePaths: sanitized.removedCandidatePaths,
    warnings: sanitized.warnings,
  };
}
