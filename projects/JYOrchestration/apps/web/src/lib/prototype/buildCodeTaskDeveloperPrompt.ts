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
    "- 이 CodeTask 범위만 수정하고 허용 경로 안에서만 변경할 것",
    "- 요구사항을 충족하는 코드 변경",
    "- 변경 후 commit을 생성하고 원격 work branch에 push할 것",
    "- push 후 branch head(또는 commit SHA)가 GitHub에서 확인 가능해야 함",
    "- 코드 변경이 불필요하면 noCodeChange 근거(검토한 파일·검증 요약)를 명확히 기록",
    "",
    "## GitHub 정책",
    `- 저장소: ${input.targetRepository.repoFullName}`,
    `- base branch: ${input.baseBranch}`,
    `- work branch: ${workBranch}`,
    "- 작업 완료 후 위 work branch에 commit·push만 수행할 것 (PR 생성·merge는 플랫폼이 담당하므로 금지)",
    ...(input.allowedPathGlobs?.length
      ? [
          "",
          "## 허용 경로",
          ...input.allowedPathGlobs.map((g) => `- ${g}`),
          "- 위 경로 밖 파일은 수정하지 말 것",
        ]
      : ["", "## 허용 경로", "- (플랫폼 허용 경로 미지정 — 관련 최소 범위만 수정)"]),
  ];

  return sections.filter((line) => line !== undefined).join("\n").trim();
}
