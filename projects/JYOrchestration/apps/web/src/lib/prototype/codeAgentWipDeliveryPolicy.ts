import {
  codeAgentProviderLabel,
  DEFAULT_CODE_AGENT_PROVIDER,
  type CodeAgentProvider,
} from "@/lib/prototype/codeAgentProvider";

export const CODE_AGENT_WIP_POLICY_HEADING = "## WIP 작업 정책" as const;
export const CODE_AGENT_GIT_DELIVERY_HEADING = "## GitHub WIP 반영 (필수)" as const;

export type CodeAgentWipPolicyContext = Readonly<{
  readonly provider?: CodeAgentProvider;
  readonly workBranch?: string;
  readonly taskId?: string;
  readonly baseBranch?: string;
}>;

export function buildCodeAgentWipPolicyLines(
  input: CodeAgentWipPolicyContext = {},
): readonly string[] {
  const provider = input.provider ?? DEFAULT_CODE_AGENT_PROVIDER;
  const label = codeAgentProviderLabel(provider);
  const branch = input.workBranch?.trim();
  const taskId = input.taskId?.trim();
  const baseBranch = input.baseBranch?.trim() || "main";

  return [
    "- 이 작업은 검토용 Code Agent WIP 작업이다.",
    `- 실행 도구는 ${label}이다.`,
    `- ${baseBranch} 등 기본 브랜치에 직접 merge/commit하지 않는다.`,
    branch
      ? `- **반드시** GitHub remote WIP branch \`${branch}\`에서만 작업한다.`
      : "- **반드시** 지정된 WIP branch에서만 작업한다.",
    "- 작업 완료 전 WIP branch에 commit을 생성하고 **GitHub remote에 push**해야 한다. (플랫폼 GitHub 검수 필수)",
    "- WIP branch push는 **필수**이다. SCM이 담당하는 main 반영용 PR/merge만 수행하지 않는다.",
    taskId
      ? `- commit message에 taskId \`${taskId}\` 를 반드시 포함한다.`
      : "- commit message에 taskId를 반드시 포함한다.",
    "- 변경 파일 목록, diff 요약, 테스트 결과, commitSha, push 결과, 미해결 이슈를 보고한다.",
    "- AI개발자 승인 전에는 공식(main) 반영 대상으로 보지 않는다.",
  ];
}

export function buildCodeAgentWipPolicySection(
  input: CodeAgentWipPolicyContext = {},
): string {
  return [CODE_AGENT_WIP_POLICY_HEADING, "", ...buildCodeAgentWipPolicyLines(input)].join("\n");
}

export function buildCodeAgentGitDeliveryRequirementSection(input: {
  readonly workBranch: string;
  readonly taskId: string;
  readonly commitMessage: string;
  readonly targetRepository: string;
  readonly baseBranch?: string;
}): string {
  const workBranch = input.workBranch.trim();
  const taskId = input.taskId.trim();
  const baseBranch = input.baseBranch?.trim() || "main";

  return [
    CODE_AGENT_GIT_DELIVERY_HEADING,
    `- 저장소: ${input.targetRepository.trim()}`,
    `- base branch: \`${baseBranch}\` (여기에 직접 commit하지 않음)`,
    `- WIP branch: \`${workBranch}\` (생성·checkout·push 대상)`,
    `- commit message에 taskId \`${taskId}\` 포함 (권장: \`${input.commitMessage.trim()}\`)`,
    "- 완료 전 GitHub에서 WIP branch와 commit이 보이는지 self-check한다.",
    "- API 완료 응답에 commitSha, changedFiles, push 성공 여부를 포함한다.",
  ].join("\n");
}

export function promptIncludesWipPolicy(prompt: string): boolean {
  return prompt.includes(CODE_AGENT_WIP_POLICY_HEADING);
}

export function appendCodeAgentWipPolicyToPrompt(
  prompt: string,
  context: CodeAgentWipPolicyContext = {},
): string {
  if (promptIncludesWipPolicy(prompt)) return prompt.trim();
  return `${prompt.trim()}\n\n${buildCodeAgentWipPolicySection(context)}\n`;
}

/** 슬롯·요약 UI용 WIP 정책 한 줄 요약 */
export const CODE_AGENT_WIP_POLICY_SLOT_LINES = [
  "WIP branch에서만 작업",
  "WIP commit 생성 후 GitHub push 필수",
  "main 반영용 PR/merge는 SCM 담당",
  "AI개발자 승인 전 공식 반영 금지",
] as const;

export const TASK_CURSOR_DEFERRED_GITHUB_VERIFY_HINT =
  "Cloud Agent 완료 — commitSha가 없어 GitHub WIP branch push 여부를 확인합니다. WIP branch에 commit이 push되지 않으면 검수에 실패합니다." as const;

export const CODE_AGENT_TASK_COMPLETION_HEADING = "## 작업 완료 조건" as const;

export function buildCodeAgentTaskCompletionRequirementLines(input?: {
  readonly workBranch?: string;
  readonly taskId?: string;
}): readonly string[] {
  const workBranch = input?.workBranch?.trim();
  const taskId = input?.taskId?.trim();
  return [
    "1. 반드시 작업 브랜치 wip/cursor/{taskId}를 생성하거나 해당 브랜치로 checkout한다.",
    workBranch
      ? `   (이번 작업 WIP branch: \`${workBranch}\`)`
      : "   (taskId 기준 wip/cursor/{task-slug} 형식)",
    "2. 실제 변경이 있으면 반드시 commit을 생성한다.",
    taskId
      ? `3. commit message에는 [\`${taskId}\`] 또는 taskId \`${taskId}\`를 포함한다.`
      : "3. commit message에는 [TASK-ID]를 포함한다.",
    "4. 작업 브랜치는 GitHub remote에 push한다.",
    "5. 응답에는 branchName, commitSha(또는 commitHash), changedFiles를 포함한다.",
    "6. push 실패 시 completed로 응답하지 말고 실패로 보고한다.",
    "7. 코드 변경이 불필요하면 noCodeChange=true와 inspectedFiles, validationSummary를 반환한다.",
    "8. diffSummary만 있고 commit/branch/changedFiles/noCodeChange 증거가 없으면 완료로 처리하지 않는다.",
  ];
}

export function buildCodeAgentTaskCompletionRequirementSection(input?: {
  readonly workBranch?: string;
  readonly taskId?: string;
}): string {
  return [CODE_AGENT_TASK_COMPLETION_HEADING, ...buildCodeAgentTaskCompletionRequirementLines(input)].join(
    "\n",
  );
}
