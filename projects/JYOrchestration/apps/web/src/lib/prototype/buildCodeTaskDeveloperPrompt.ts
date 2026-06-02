import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";

export function buildCodeTaskDeveloperPrompt(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
}): string {
  const workBranch = buildCodeTaskWorkBranch(input.codeTask.codeTaskId);
  const parentTitle = input.parentTask?.title?.trim() || input.codeTask.parentTaskId;
  const candidateFiles = [
    ...(input.codeTask.candidateFiles ?? []),
    ...(input.codeTask.candidateFileHints ?? []),
  ].filter(Boolean);

  const sections = [
    "# CodeTask 개발 요청",
    "",
    "## 작업 목표",
    input.codeTask.title,
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
    ...(candidateFiles.length
      ? candidateFiles.map((f) => `- ${f}`)
      : ["- (후보 없음 — 관련 파일을 스스로 탐색)"]),
    "",
    "## 구현 요구사항",
    ...(input.codeTask.acceptanceCriteria.length
      ? input.codeTask.acceptanceCriteria.map((c) => `- ${c}`)
      : ["- acceptance criteria를 충족할 것"]),
    "",
    "## 검증 힌트",
    ...(input.codeTask.verificationHints.length
      ? input.codeTask.verificationHints.map((h) => `- ${h}`)
      : ["- 로컬 빌드/테스트 후 동작 확인"]),
    "",
    "## 금지사항",
    ...(input.codeTask.forbiddenPaths.length
      ? input.codeTask.forbiddenPaths.map((p) => `- ${p}`)
      : ["- 무관한 대규모 리팩터링 금지"]),
    "",
    "## 완료 기준",
    "- 요구사항을 충족하는 코드 변경",
    "- GitHub에 commit / push / PR 생성",
    "- 코드 변경이 불필요하면 noCodeChange 근거(검토한 파일·검증 요약)를 명확히 기록",
    "",
    "## GitHub 정책",
    `- 저장소: ${input.targetRepository.repoFullName}`,
    `- base branch: ${input.baseBranch}`,
    `- work branch: ${workBranch}`,
    "- 작업 완료 후 위 work branch에 commit·push하고 PR을 생성할 것",
    `- PR 제목/본문에 CodeTask ID(${input.codeTask.codeTaskId})와 제목(${input.codeTask.title})을 명확히 포함할 것`,
    ...(input.allowedPathGlobs?.length
      ? ["", "## 허용 경로", ...input.allowedPathGlobs.map((g) => `- ${g}`)]
      : []),
  ];

  return sections.filter((line) => line !== undefined).join("\n").trim();
}
