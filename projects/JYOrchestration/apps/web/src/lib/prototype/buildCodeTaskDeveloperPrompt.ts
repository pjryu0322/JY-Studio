import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  resolveEffectiveAllowedPathGlobs,
  resolveForbiddenPathGlobsForTargetRepo,
  sanitizeCandidatePathsForTargetRepo,
  type CodeTaskPromptTargetRepoKind,
} from "@/lib/prototype/codeTaskPromptPathPolicy";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";

export type BuildCodeTaskDeveloperPromptResult = Readonly<{
  readonly prompt: string;
  readonly removedCandidatePaths: readonly string[];
  readonly warnings: readonly string[];
}>;

function buildImplementationGoalSection(codeTask: ImplementationCodeTaskV1): readonly string[] {
  const title = codeTask.title.trim();
  if (!/오류|error|에러/i.test(title) && !/오류|error|에러/i.test(codeTask.description)) {
    return [];
  }
  return [
    "",
    "## 구현 목표 (오류/피드백 UI)",
    "- 대상 프로젝트에 공통 오류 메시지 UI/상태 처리 기능을 구현한다.",
    "- API 실패, 폼 검증 실패, 데이터 로딩 실패, 권한 오류 등에서 재사용 가능해야 한다.",
    "- ErrorMessage 또는 ErrorState 공통 컴포넌트 추가 (message, description, variant, retry action).",
    "- role=\"alert\" 또는 aria-live로 접근성 반영.",
    "- 기존 화면/상태 흐름 중 최소 1곳에 연동하고 정상/오류/재시도 흐름을 구분한다.",
  ];
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
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly targetRepoKind?: CodeTaskPromptTargetRepoKind;
}): BuildCodeTaskDeveloperPromptResult {
  const targetRepoKind = input.targetRepoKind ?? "generated_project";
  const repoFullName = input.targetRepository.repoFullName.trim();
  const workBranch = buildCodeTaskWorkBranch(input.codeTask.codeTaskId);
  const parentTitle = input.parentTask?.title?.trim() || input.codeTask.parentTaskId;

  const rawCandidates = [
    ...(input.codeTask.candidateFiles ?? []),
    ...(input.codeTask.candidateFileHints ?? []),
  ].filter(Boolean);

  const sanitized = sanitizeCandidatePathsForTargetRepo({
    candidatePaths: rawCandidates,
    targetRepoFullName: repoFullName,
    targetRepoKind,
  });

  const allowedPathGlobs = resolveEffectiveAllowedPathGlobs({
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoFullName: repoFullName,
    targetRepoKind,
  });

  const defaultForbidden = resolveForbiddenPathGlobsForTargetRepo({ targetRepoKind });
  const forbiddenFromTask = (input.codeTask.forbiddenPaths ?? [])
    .map((p) => String(p).trim())
    .filter(Boolean);
  const forbiddenPaths = [...new Set([...defaultForbidden, ...forbiddenFromTask])];

  const candidateSection =
    sanitized.safeCandidatePaths.length > 0
      ? sanitized.safeCandidatePaths.map((f) => `- ${f}`)
      : targetRepoKind === "generated_project"
        ? [
            "- 대상 저장소 내부에서 관련 컴포넌트/화면/상태 모듈을 탐색해 최소 범위로 수정",
            "- 저장소 package.json scripts를 확인한 뒤 실제 구조에 맞게 경로를 좁혀 수정",
          ]
        : ["- (후보 없음 — 관련 파일을 스스로 탐색)"];

  const repoScopeLines =
    targetRepoKind === "generated_project"
      ? [
          "## 작업 저장소 기준",
          `- 이 작업은 \`${repoFullName}\` 저장소의 work branch에서 수행한다.`,
          "- JYOrchestration 플랫폼 소스는 수정하지 않는다.",
          "- 아래 허용 경로는 대상 저장소 내부 경로 기준이다.",
          "",
        ]
      : [];

  const sections = [
    "# CodeTask 개발 요청",
    "",
    ...repoScopeLines,
    "## 작업 목표",
    input.codeTask.title,
    ...buildImplementationGoalSection(input.codeTask),
    "",
    "## Process Task",
    `- ID: ${input.codeTask.parentTaskId}`,
    `- 제목: ${parentTitle}`,
    input.parentTask?.description?.trim()
      ? `- 설명: ${input.parentTask.description.trim()}`
      : "",
    "",
    "## CodeTask",
    `- ID: ${input.codeTask.codeTaskId}`,
    `- 제목: ${input.codeTask.title}`,
    `- 설명: ${input.codeTask.description.trim()}`,
    `- 변경 유형: ${input.codeTask.changeType}`,
    "",
    "## 수정 대상 파일 후보",
    ...candidateSection,
    "",
    "## 구현 요구사항",
    ...(input.codeTask.acceptanceCriteria.length
      ? input.codeTask.acceptanceCriteria.map((c) => `- ${c}`)
      : ["- acceptance criteria를 충족할 것"]),
    "",
    "## 검증 힌트",
    ...(input.codeTask.verificationHints.length
      ? input.codeTask.verificationHints.map((h) => `- ${h}`)
      : [
          "- 오류 상태가 화면에 표시되는지 확인",
          "- 대상 저장소 package.json scripts 확인 후 가능한 build/test 실행",
        ]),
    "",
    "## 금지사항",
    ...forbiddenPaths.map((p) => `- ${p}`),
    "- 무관한 대규모 리팩터링 금지",
    "",
    "## 완료 기준",
    "- 이 CodeTask 범위만 수정하고 허용 경로 안에서만 변경할 것",
    "- 요구사항을 충족하는 코드 변경",
    "- 변경 후 commit을 생성하고 원격 work branch에 push할 것",
    "- push 후 branch head(또는 commit SHA)가 GitHub에서 확인 가능해야 함",
    "- 코드 변경이 불필요하면 noCodeChange 근거(검토한 파일·검증 요약)를 명확히 기록",
    "",
    "## GitHub 정책",
    `- 저장소: ${repoFullName}`,
    `- base branch: ${input.baseBranch}`,
    `- work branch: ${workBranch}`,
    "- 작업 완료 후 위 work branch에 commit·push만 수행할 것 (PR 생성·merge는 플랫폼이 담당하므로 금지)",
    "",
    "## 허용 경로",
    ...allowedPathGlobs.map((g) => `- ${g}`),
    "- 위 경로는 대상 저장소 루트 기준이며, 밖의 파일은 수정하지 말 것",
  ];

  return {
    prompt: sections.filter((line) => line !== undefined).join("\n").trim(),
    removedCandidatePaths: sanitized.removedCandidatePaths,
    warnings: sanitized.warnings,
  };
}
