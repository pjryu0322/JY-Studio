import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import {
  buildProviderWipBranchName,
  buildProviderWipCommitMessage,
  codeAgentIsNotSingleChatMember,
  codeAgentProviderLabel,
  DEFAULT_CODE_AGENT_PROVIDER,
  inferCodeAgentProviderFromBranch,
  type CodeAgentProvider,
} from "@/lib/prototype/codeAgentProvider";
import type { CodeAgentTargetRepositorySnapshot } from "@/lib/prototype/projectTargetRepository";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { IMPLEMENTATION_ENV_SETTINGS_LABEL } from "@/lib/requirements/implementationUxLabels";

export const CODE_AGENT_WIP_EXECUTION_VERSION = "code_agent_wip_execution_v1" as const;

export const CODE_AGENT_WIP_WORK_REQUEST_CHIP = "코드 에이전트 WIP 작업 요청";
/** @deprecated — 이전 칩 라벨; WIP 요청과 동일하게 라우팅 */
export const LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP = "Cursor WIP 작업 요청";
/** @deprecated — 이전 칩 라벨; WIP 요청과 동일하게 라우팅 */
export const LEGACY_CURSOR_EXECUTION_REQUEST_CHIP = "Cursor 실행 요청";

export function buildCodeAgentWipPolicySection(provider: CodeAgentProvider = DEFAULT_CODE_AGENT_PROVIDER): string {
  const label = codeAgentProviderLabel(provider);
  return `## WIP 작업 정책

- 이 작업은 검토용 Code Agent WIP 작업이다.
- 실행 도구는 ${label}이다.
- main 브랜치에 직접 반영하지 않는다.
- 공식 push/PR/merge를 수행하지 않는다.
- WIP branch에서만 작업한다.
- 작업 완료 후 WIP commit을 생성한다.
- 변경 파일 목록, diff 요약, 테스트 결과, 미해결 이슈를 보고한다.
- AI개발자 승인 전에는 공식 반영 대상으로 보지 않는다.`;
}

export const CODE_AGENT_WIP_POLICY_SECTION = buildCodeAgentWipPolicySection(DEFAULT_CODE_AGENT_PROVIDER);

export type CodeAgentWipExecutionStatus =
  | "not_requested"
  | "requested"
  | "drafting"
  | "wip_committed"
  | "developer_reviewing"
  | "refactor_requested"
  | "refactoring"
  | "wip_updated"
  | "developer_approved"
  | "scm_commit_pending"
  | "failed";

export type CodeAgentWipExecutionMode = "stub" | "cursor_bridge" | "cursor_api" | "external";

export type CodeAgentBridgeAdapter = "cursor_api";

export type CodeAgentWipBridgeExecutionStatus =
  | "draft_created"
  | "draft_approved"
  | "bridge_requested"
  | "bridge_running"
  | "bridge_completed"
  | "failed"
  | "cancelled";

export type CodeAgentCursorApiExecutionStatus =
  | "bridge_completed"
  | "cursor_api_failed"
  | "cursor_api_unsupported";

export const REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP = "Cursor 실행 요청" as const;

export {
  formatCursorExecutionAvailabilityDiagnosticLines as formatCursorBridgeAvailabilityDiagnosticLines,
} from "@/lib/prototype/cursorExecutionAvailability";

export type CodeAgentWipCommit = Readonly<{
  sha?: string;
  provider: CodeAgentProvider;
  branchName: string;
  commitMessage: string;
  taskId: string;
  workItemId: string;
  changedFiles: readonly string[];
  diffSummary: readonly string[];
  testResults: readonly string[];
  unresolvedIssues: readonly string[];
  createdAt: string;
  targetRepository?: string;
}>;

export type CodeAgentDeveloperReviewStatus = "pending" | "approved" | "refactor_requested" | "rejected";

export type CodeAgentDeveloperReview = Readonly<{
  status: CodeAgentDeveloperReviewStatus;
  reviewedAt: string;
  reviewedBy: "ai_developer";
  summary: string;
  findings: readonly string[];
  requestedActions: readonly string[];
}>;

export type CodeAgentRefactorRequest = Readonly<{
  id: string;
  requestedAt: string;
  requestedBy: "ai_developer";
  provider: CodeAgentProvider;
  reason: string;
  instructions: string;
  targetCommitSha?: string;
  status: "requested" | "applied" | "cancelled";
}>;

export type CodeAgentWipExecutionV1 = Readonly<{
  version: typeof CODE_AGENT_WIP_EXECUTION_VERSION;
  projectId: string;
  provider: CodeAgentProvider;
  status: CodeAgentWipExecutionStatus;
  branchName: string;
  requestedAt: string;
  requestedBy: "ai_developer";
  workItems: readonly string[];
  commits: readonly CodeAgentWipCommit[];
  developerReview?: CodeAgentDeveloperReview;
  refactorRequests: readonly CodeAgentRefactorRequest[];
  /** Task-scoped WIP selection from execution board. */
  selectedTaskId?: string;
  selectedWorkItemIds?: readonly string[];
  /** Stub vs real Cursor bridge execution. */
  executionMode?: CodeAgentWipExecutionMode;
  /** Transport used for Cursor source generation. */
  bridgeAdapter?: CodeAgentBridgeAdapter;
  /** Bridge lifecycle (distinct from workflow `status`). */
  bridgeExecutionStatus?: CodeAgentWipBridgeExecutionStatus;
  /** Fine-grained Cursor API outcome for new executions. */
  executionStatus?: CodeAgentCursorApiExecutionStatus | CodeAgentWipBridgeExecutionStatus;
  bridgeCompletedAt?: string;
  bridgeErrorMessage?: string;
  pushed?: boolean;
  pushStatus?: "success" | "skipped" | "failed";
  pushErrorMessage?: string;
  prStatus?: string;
  prNumber?: number;
  commitSha?: string;
  /** Target project Git repository (owner/repo). */
  targetRepository?: string;
  targetRepoFullName?: string;
  targetRepositorySnapshot?: CodeAgentTargetRepositorySnapshot;
  workspacePath?: string;
  baseBranch?: string;
  bridgeAllowedPathGlobs?: readonly string[];
  bridgeAutoPush?: boolean;
  bridgeAutoPr?: boolean;
}>;

function latestWipCommit(wip: CodeAgentWipExecutionV1): CodeAgentWipCommit | undefined {
  return wip.commits[wip.commits.length - 1];
}

export function isRealCursorSourceGenerationCompleted(wip: CodeAgentWipExecutionV1): boolean {
  if (wip.bridgeExecutionStatus !== "bridge_completed") return false;
  const modeOk =
    wip.executionMode === "cursor_api" ||
    wip.executionMode === "cursor_bridge" ||
    wip.bridgeAdapter === "cursor_api";
  if (!modeOk) return false;
  const last = latestWipCommit(wip);
  const sha = String(last?.sha ?? wip.commitSha ?? "").trim();
  if (!sha || sha.startsWith("wip-stub")) return false;
  const changedFiles = last?.changedFiles ?? [];
  return changedFiles.length > 0;
}

export type { CodeAgentTargetRepositorySnapshot } from "@/lib/prototype/projectTargetRepository";

export { codeAgentIsNotSingleChatMember };

export function appendWipPolicyToCodeAgentPrompt(
  prompt: string,
  provider: CodeAgentProvider = DEFAULT_CODE_AGENT_PROVIDER,
): string {
  if (prompt.includes("## WIP 작업 정책")) return prompt;
  return `${prompt.trim()}\n\n${buildCodeAgentWipPolicySection(provider)}\n`;
}

export function buildInitialCodeAgentWipExecution(input: {
  readonly projectId: string;
  readonly plan: ImplementationTaskPlanV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly provider?: CodeAgentProvider;
  readonly selectedTaskId?: string;
  readonly executionMode?: CodeAgentWipExecutionMode;
  readonly bridgeExecutionStatus?: CodeAgentWipBridgeExecutionStatus;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const provider = input.provider ?? DEFAULT_CODE_AGENT_PROVIDER;
  const primaryTaskId =
    input.selectedTaskId?.trim() ||
    input.workItems[0]?.taskId?.trim() ||
    input.plan.items[0]?.id ||
    "bundle";
  const branchName = buildProviderWipBranchName(provider, input.projectId, primaryTaskId);
  return {
    version: CODE_AGENT_WIP_EXECUTION_VERSION,
    projectId: input.projectId.trim(),
    provider,
    status: "requested",
    branchName,
    requestedAt: now,
    requestedBy: "ai_developer",
    workItems: input.workItems.map((w) => w.id),
    commits: [],
    refactorRequests: [],
    executionMode: input.executionMode ?? "stub",
    bridgeExecutionStatus: input.bridgeExecutionStatus ?? "draft_created",
    ...(input.selectedTaskId?.trim() ? { selectedTaskId: input.selectedTaskId.trim() } : {}),
  };
}

export function buildStubCodeAgentWipCommit(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly plan: ImplementationTaskPlanV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly nowIso?: string;
}): CodeAgentWipCommit {
  const now = input.nowIso ?? new Date().toISOString();
  const taskId =
    input.wip.selectedTaskId?.trim() ||
    input.workItems[0]?.taskId?.trim() ||
    input.plan.items[0]?.id ||
    "unknown";
  const item = input.plan.items.find((t) => t.id === taskId) ?? input.plan.items[0];
  const workItem = input.workItems.find((w) => w.taskId === taskId) ?? input.workItems[0];
  const hints = item?.executionHints;
  const changedFiles = [
    ...(hints?.candidateFiles.slice(0, 3) ?? []),
    ...(workItem?.requiredFilesHint.slice(0, 2) ?? []),
  ].filter(Boolean);
  return {
    provider: input.wip.provider,
    sha: `wip-stub-${now.replace(/[:.]/g, "")}`,
    branchName: input.wip.branchName,
    commitMessage: buildProviderWipCommitMessage(
      input.wip.provider,
      item?.title ?? workItem?.title ?? "implementation",
      false,
      taskId,
    ),
    taskId,
    workItemId: workItem?.id ?? "unknown",
    changedFiles: changedFiles.length ? changedFiles : ["projects/JYOrchestration/apps/web/src/lib/prototype/ (stub)"],
    diffSummary: [
      "WIP 초안: 기획 범위 내 구현 스켈레톤 반영 (stub, 실제 diff는 다음 bridge 단계)",
      "테스트·타입 정합성 점검 대기",
    ],
    testResults: ["stub validation: passed", "실제 pnpm test/build: 미실행"],
    unresolvedIssues: [
      "아직 실제 Cursor API 실행, 공식 push, PR, merge는 수행되지 않았습니다.",
    ],
    createdAt: now,
  };
}

export function applyStubWipCommitToExecution(
  wip: CodeAgentWipExecutionV1,
  commit: CodeAgentWipCommit,
): CodeAgentWipExecutionV1 {
  const label = codeAgentProviderLabel(wip.provider);
  return {
    ...wip,
    status: "developer_reviewing",
    commits: [...wip.commits, commit],
    developerReview: {
      status: "pending",
      reviewedAt: commit.createdAt,
      reviewedBy: "ai_developer",
      summary: `${label} WIP commit 결과 검토 대기`,
      findings: commit.unresolvedIssues,
      requestedActions: [],
    },
  };
}

export function buildCodeAgentWipRequestedMessage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly plan: ImplementationTaskPlanV1;
  readonly nowIso?: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const label = codeAgentProviderLabel(input.wip.provider);
  const taskLines = input.plan.items.map((t, i) => `${i + 1}. ${t.title}`).join("\n");
  return newRequirementsMessage({
    id: `code-agent-wip-requested-${input.wip.requestedAt}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "코드 에이전트 WIP 작업을 요청했습니다.",
      "",
      `실행 도구: ${label} (SingleChat 멤버가 아닌 Code Agent)`,
      "",
      `WIP branch: \`${input.wip.branchName}\``,
      "",
      "대상 task:",
      taskLines,
      "",
      "WIP 정책:",
      "- 공식 PR/merge 전 검토용 작업입니다.",
      "- 작업 완료 후 WIP commit 기준으로 검토합니다.",
      "- AI개발자 승인 전에는 SCM 공식 반영을 진행하지 않습니다.",
    ].join("\n"),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: "CODE_AGENT_WIP_REQUESTED_V1",
      serviceDesignStage: "implementation",
      interviewAllowCustomInput: true,
    },
  });
}

export const CODE_AGENT_WIP_REVIEW_CHIPS = [
  "변경사항 보기",
  "리팩토링 요청",
  "추가 수정 요청",
  "구현 결과 승인",
  "작업 폐기",
] as const;

export const CODE_AGENT_WIP_DRAFT_APPROVE_CHIP = "WIP 초안 승인" as const;

export function isStubCodeAgentWipExecution(wip: CodeAgentWipExecutionV1): boolean {
  if (wip.executionMode === "cursor_api" && wip.bridgeExecutionStatus === "bridge_completed") {
    return false;
  }
  if (wip.executionMode === "cursor_bridge" && wip.bridgeExecutionStatus === "bridge_completed") {
    return false;
  }
  if (wip.bridgeExecutionStatus === "bridge_completed") {
    return false;
  }
  return (
    wip.executionMode === "stub" ||
    wip.bridgeExecutionStatus === "draft_created" ||
    wip.bridgeExecutionStatus === "draft_approved" ||
    (!wip.executionMode && !wip.bridgeExecutionStatus)
  );
}

export function deriveCodeAgentWipReviewChips(wip: CodeAgentWipExecutionV1): readonly string[] {
  if (wip.bridgeExecutionStatus === "failed") {
    return [REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP, "추가 수정 요청", "작업 폐기"];
  }
  if (isRealCursorSourceGenerationCompleted(wip)) {
    return [...CODE_AGENT_WIP_REVIEW_CHIPS];
  }
  if (isStubCodeAgentWipExecution(wip)) {
    const chips: string[] = [REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP];
    if (wip.bridgeExecutionStatus === "draft_created") {
      chips.push(CODE_AGENT_WIP_DRAFT_APPROVE_CHIP);
    }
    chips.push(IMPLEMENTATION_ENV_SETTINGS_LABEL, "작업 폐기");
    return chips;
  }
  return [...CODE_AGENT_WIP_REVIEW_CHIPS];
}

/** Board message CTAs when codeAgentWipExecutionV1 is present. */
export function deriveCodeAgentWipBoardInterviewChips(
  wip: CodeAgentWipExecutionV1,
): readonly string[] | null {
  if (wip.bridgeExecutionStatus === "failed") {
    return [REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP, "추가 수정 요청", "작업 폐기"];
  }
  if (isRealCursorSourceGenerationCompleted(wip)) {
    return ["구현 결과 승인", "변경사항 보기", "추가 수정 요청", "작업 폐기"];
  }
  if (wip.bridgeExecutionStatus === "draft_approved") {
    return [REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP, IMPLEMENTATION_ENV_SETTINGS_LABEL, "작업 폐기"];
  }
  if (wip.bridgeExecutionStatus === "draft_created" || isStubCodeAgentWipExecution(wip)) {
    return [
      REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
      CODE_AGENT_WIP_DRAFT_APPROVE_CHIP,
      IMPLEMENTATION_ENV_SETTINGS_LABEL,
      "작업 폐기",
    ];
  }
  return null;
}

export function formatCodeAgentExecutionModeDiagnosticLines(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): readonly string[] {
  if (!wip) {
    return [
      "Code Agent 실행 모드:",
      "- 현재: (WIP 초안 없음)",
      "- 실제 Cursor API: 미설정",
    ];
  }
  if (isRealCursorSourceGenerationCompleted(wip)) {
    const last = wip.commits[wip.commits.length - 1];
    const repo = wip.targetRepositorySnapshot?.repoFullName ?? wip.targetRepoFullName ?? wip.targetRepository;
    const modeLabel =
      wip.executionMode === "cursor_api" || wip.bridgeAdapter === "cursor_api"
        ? "Cursor API 완료"
        : "Cursor 실행 완료";
    return [
      "Code Agent 실행 모드:",
      `- 현재: ${modeLabel}`,
      ...(repo ? [`- Git 저장소: ${repo}`] : []),
      ...(wip.workspacePath ? [`- 작업 경로: ${wip.workspacePath}`] : []),
      ...(wip.baseBranch ? [`- 기준 브랜치: ${wip.baseBranch}`] : []),
      `- 실제 commit: ${last?.sha ?? "(없음)"}`,
      ...(wip.pushed ? ["- push: 완료"] : ["- push: 미수행"]),
    ];
  }
  const cursorApiConfigured = Boolean(
    wip.targetRepositorySnapshot?.repoFullName && wip.workspacePath?.trim(),
  );
  if (wip.bridgeExecutionStatus === "draft_approved" && isStubCodeAgentWipExecution(wip)) {
    return [
      "Code Agent 실행 모드:",
      "- 현재: WIP 초안 승인됨",
      ...(wip.selectedTaskId ? [`- 선택 작업: ${wip.selectedTaskId}`] : []),
      `- 실제 Cursor API: ${cursorApiConfigured ? "설정 확인됨 (미실행)" : "미설정"}`,
    ];
  }
  if (isStubCodeAgentWipExecution(wip)) {
    return [
      "Code Agent 실행 모드:",
      "- 현재: WIP 초안 생성됨",
      ...(wip.selectedTaskId ? [`- 선택 작업: ${wip.selectedTaskId}`] : []),
      `- 실제 Cursor API: ${cursorApiConfigured ? "설정 확인됨 (미실행)" : "미설정"}`,
      ...(wip.targetRepositorySnapshot || wip.workspacePath
        ? [
            "실제 소스 생성 대상:",
            ...(wip.targetRepositorySnapshot
              ? [`- Git 저장소: ${wip.targetRepositorySnapshot.repoFullName}`]
              : []),
            ...(wip.baseBranch ? [`- 기준 브랜치: ${wip.baseBranch}`] : []),
            ...(wip.workspacePath ? [`- 작업 경로: ${wip.workspacePath}`] : []),
          ]
        : []),
    ];
  }
  if (wip.bridgeExecutionStatus === "failed") {
    return [
      "Code Agent 실행 모드:",
      "- 현재: Cursor API 실행 실패",
      ...(wip.bridgeErrorMessage ? [`- 사유: ${wip.bridgeErrorMessage}`] : []),
    ];
  }
  return [
    "Code Agent 실행 모드:",
    `- 현재: ${wip.executionMode ?? "stub"}`,
    `- bridge 상태: ${wip.bridgeExecutionStatus ?? "unknown"}`,
  ];
}

export function buildCodeAgentWipDraftCreatedMessage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly commit: CodeAgentWipCommit;
  readonly selectedTaskId: string;
  readonly selectedWorkItems: readonly CursorWorkItem[];
  readonly totalCandidateCount?: number;
  readonly nowIso?: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const label = codeAgentProviderLabel(input.commit.provider);
  const cursorApiConfigured = Boolean(
    input.wip.targetRepositorySnapshot?.repoFullName && input.wip.workspacePath?.trim(),
  );
  const taskTitle =
    input.selectedWorkItems[0]?.title ||
    input.commit.commitMessage.replace(/^wip\([^)]+\):\s*/i, "");
  const scopedSummary =
    input.totalCandidateCount !== undefined
      ? [
          "",
          "TaskList 기준 WIP 후보:",
          `- 전체 후보: ${input.totalCandidateCount}건`,
          `- 이번 요청 대상: ${input.selectedTaskId}`,
          `- 요청 workItems: ${input.selectedWorkItems.length}건`,
        ]
      : [];

  return newRequirementsMessage({
    id: `code-agent-wip-draft-${input.commit.createdAt}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "Code Agent WIP 초안이 생성되었습니다.",
      "",
      "선택 작업:",
      `- ${input.selectedTaskId} / ${taskTitle}`,
      "",
      "상태:",
      "- WIP 초안 생성",
      `- 실제 Cursor API: ${cursorApiConfigured ? "설정 확인됨 (미실행)" : "미설정"}`,
      "",
      `실행 도구: ${label}`,
      "",
      "작업 브랜치:",
      `- ${input.commit.branchName}`,
      "",
      "WIP Commit 초안:",
      `- ${input.commit.commitMessage}`,
      input.commit.sha ? `- sha: ${input.commit.sha}` : "",
      "",
      "diff 요약:",
      ...input.commit.diffSummary.map((d) => `- ${d}`),
      "",
      "테스트 결과:",
      ...input.commit.testResults.map((t) => `- ${t}`),
      "",
      "안내:",
      "- 현재 결과는 실제 Cursor 실행 결과가 아니라 WIP 초안입니다.",
      "- 실제 소스 생성을 진행하려면 환경설정에서 Cursor API를 저장한 뒤 [Cursor 실행 요청]을 실행해야 합니다.",
      ...scopedSummary,
      "",
      "다음 액션을 선택해 주세요.",
    ]
      .filter(Boolean)
      .join("\n"),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: "CODE_AGENT_WIP_REVIEW_V1",
      serviceDesignStage: "implementation",
      interviewSuggestions: [...deriveCodeAgentWipReviewChips(input.wip)],
      interviewAllowCustomInput: true,
    },
  });
}

export function buildCodeAgentWipBridgeCompletedMessage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly commit: CodeAgentWipCommit;
  readonly nowIso?: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const label = codeAgentProviderLabel(input.commit.provider);
  const taskId = input.wip.selectedTaskId ?? input.commit.taskId;
  return newRequirementsMessage({
    id: `code-agent-wip-review-${input.commit.createdAt}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "Cursor API가 대상 프로젝트 저장소에 실제 소스를 생성했습니다.",
      "",
      "대상 저장소:",
      `- ${input.wip.targetRepositorySnapshot?.repoFullName ?? input.wip.targetRepoFullName ?? input.wip.targetRepository ?? "(미기록)"}`,
      "",
      ...(input.wip.workspacePath ? ["작업 경로:", `- ${input.wip.workspacePath}`, ""] : []),
      ...(input.wip.baseBranch ? ["기준 브랜치:", `- ${input.wip.baseBranch}`, ""] : []),
      "작업 브랜치:",
      `- ${input.commit.branchName}`,
      "",
      "Commit:",
      input.commit.sha ? `- ${input.commit.sha}` : "",
      "",
      "변경 파일:",
      ...input.commit.changedFiles.map((f) => `- ${f}`),
      "",
      input.wip.pushStatus || input.wip.prStatus
        ? [
            "Push:",
            `- ${input.wip.pushStatus === "success" ? "성공" : input.wip.pushStatus === "failed" ? `실패${input.wip.pushErrorMessage ? ` — ${input.wip.pushErrorMessage}` : ""}` : "미수행"}`,
            ...(input.wip.prStatus ? ["PR:", `- ${input.wip.prStatus.replace(/^PR:\s*/, "")}`] : []),
            "",
          ].flat()
        : [
            "Push:",
            input.wip.pushed ? "- 성공" : "- 미수행 또는 skip",
            "",
          ],
      `실행 도구: ${label}`,
      "",
      "선택 작업:",
      `- ${taskId}`,
      "",
      "WIP Commit 메시지:",
      `- ${input.commit.commitMessage}`,
      "",
      "diff 요약:",
      ...input.commit.diffSummary.map((d) => `- ${d}`),
      "",
      "테스트 결과:",
      ...input.commit.testResults.map((t) => `- ${t}`),
      "",
      "미해결 이슈:",
      ...input.commit.unresolvedIssues.map((u) => `- ${u}`),
      "",
      "다음 액션을 선택해 주세요.",
    ]
      .filter(Boolean)
      .join("\n"),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: "CODE_AGENT_WIP_REVIEW_V1",
      serviceDesignStage: "implementation",
      interviewSuggestions: [...deriveCodeAgentWipReviewChips(input.wip)],
      interviewAllowCustomInput: true,
    },
  });
}

export function buildCodeAgentWipExecutionMessage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly commit: CodeAgentWipCommit;
  readonly selectedTaskId: string;
  readonly selectedWorkItems: readonly CursorWorkItem[];
  readonly totalCandidateCount?: number;
  readonly nowIso?: string;
}): RequirementsMessage {
  if (isRealCursorSourceGenerationCompleted(input.wip)) {
    return buildCodeAgentWipBridgeCompletedMessage({
      wip: input.wip,
      commit: input.commit,
      nowIso: input.nowIso,
    });
  }
  return buildCodeAgentWipDraftCreatedMessage(input);
}

/** @deprecated Use buildCodeAgentWipExecutionMessage */
export function buildCodeAgentWipReviewMessage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly commit: CodeAgentWipCommit;
  readonly nowIso?: string;
}): RequirementsMessage {
  const selectedTaskId =
    input.wip.selectedTaskId?.trim() || input.commit.taskId.trim() || "unknown";
  return buildCodeAgentWipExecutionMessage({
    wip: input.wip,
    commit: input.commit,
    selectedTaskId,
    selectedWorkItems: [],
    nowIso: input.nowIso,
  });
}

export function buildDeveloperApprovedMessage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly nowIso?: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const last = input.wip.commits[input.wip.commits.length - 1];
  const stubApproved =
    isStubCodeAgentWipExecution(input.wip) ||
    input.wip.bridgeExecutionStatus === "draft_approved";
  const selectedTaskId = input.wip.selectedTaskId?.trim();
  const content = stubApproved
    ? [
        "WIP 초안을 승인했습니다.",
        "",
        ...(selectedTaskId ? ["선택 작업:", `- ${selectedTaskId}`, ""] : []),
        `승인 WIP commit 초안: ${last?.commitMessage ?? "(없음)"}`,
        "",
        "안내:",
        "- 이번 승인은 실제 Cursor 실행 결과가 아니라 stub 초안 승인입니다.",
        "- 다음 개발 작업을 이어서 [생성요청]할 수 있습니다.",
        "- 실제 소스 생성이 필요하면 [Cursor 실행 요청]을 사용하세요. (Bridge 미연결 시 안내됨)",
      ]
    : [
        "구현 결과를 승인했습니다.",
        "",
        `승인 WIP commit: ${last?.commitMessage ?? "(없음)"}`,
        "이 WIP 결과는 공식 반영 전 검토용입니다.",
        "",
        "다음 단계: SCM에게 공식 반영을 요청해 주세요. (push/PR/merge는 SCM만 수행)",
      ];
  return newRequirementsMessage({
    id: `code-agent-wip-dev-approved-${input.nowIso ?? new Date().toISOString()}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: content.join("\n"),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: "CODE_AGENT_WIP_DEV_APPROVED_V1",
      serviceDesignStage: "implementation",
      interviewSuggestions: ["SCM에게 공식 반영 요청"],
      interviewAllowCustomInput: true,
    },
  });
}

export function buildScmOfficialCommitPendingMessage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly nowIso?: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("memo");
  const label = codeAgentProviderLabel(input.wip.provider);
  const last = input.wip.commits[input.wip.commits.length - 1];
  return newRequirementsMessage({
    id: `code-agent-wip-scm-pending-${input.nowIso ?? new Date().toISOString()}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "memo",
    speakerName: def?.title ?? "SCM",
    messageType: "STATEMENT",
    content: [
      "AI개발자가 WIP 결과를 승인했습니다.",
      "",
      "SCM 공식 반영 준비:",
      `- WIP branch: \`${input.wip.branchName}\``,
      `- WIP commit: ${last?.commitMessage ?? "(없음)"}`,
      "- 정식 branch 생성·정식 commit message 정리",
      "- push/PR 생성 준비 (이 단계에서는 placeholder — 실제 push/PR은 다음 bridge)",
      "",
      `${label} 및 기타 Code Agent는 공식 push/PR/merge를 수행하지 않습니다.`,
    ].join("\n"),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: "CODE_AGENT_WIP_SCM_PENDING_V1",
      serviceDesignStage: "implementation",
      interviewAllowCustomInput: true,
    },
  });
}

export function describeDeveloperApprovalPrecheck(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): Readonly<{ readonly title: string; readonly lines: readonly string[] }> {
  if (!wip) {
    return {
      title: "WIP 초안 또는 Cursor 실행 결과가 저장되어 있지 않습니다.",
      lines: ["먼저 [생성요청]을 실행해 WIP 초안을 생성해 주세요."],
    };
  }
  if (
    isStubCodeAgentWipExecution(wip) &&
    (wip.bridgeExecutionStatus === "draft_created" || wip.bridgeExecutionStatus === undefined)
  ) {
    return {
      title: "WIP 초안을 승인할 수 있습니다.",
      lines: ["단, 현재 결과는 실제 Cursor 실행 결과가 아니라 stub 초안입니다."],
    };
  }
  if (isRealCursorSourceGenerationCompleted(wip)) {
    return {
      title: "구현 결과를 승인할 수 있습니다.",
      lines: [],
    };
  }
  return {
    title: "승인 전 확인이 필요합니다.",
    lines: [`현재 bridge 상태: ${wip.bridgeExecutionStatus ?? "unknown"}`],
  };
}

export function evaluateDeveloperApprovalGate(wip: CodeAgentWipExecutionV1 | null | undefined): Readonly<{
  allowed: boolean;
  missing: readonly string[];
}> {
  const missing: string[] = [];
  if (!wip) {
    missing.push("WIP 초안 또는 Cursor 실행 결과가 저장되어 있지 않습니다.");
    missing.push("먼저 [생성요청]을 실행해 WIP 초안을 생성해 주세요.");
    return { allowed: false, missing };
  }
  if (wip.bridgeExecutionStatus === "draft_approved") {
    missing.push("이미 WIP 초안을 승인했습니다.");
    return { allowed: false, missing };
  }
  const okStatus = new Set<CodeAgentWipExecutionStatus>([
    "wip_committed",
    "wip_updated",
    "developer_reviewing",
    "refactor_requested",
  ]);
  if (!okStatus.has(wip.status)) missing.push(`현재 상태(${wip.status})에서는 승인 불가`);
  if (!wip.commits.length) missing.push("WIP commit 없음");
  const last = wip.commits[wip.commits.length - 1];
  if (!last?.changedFiles.length && !isStubCodeAgentWipExecution(wip)) {
    missing.push("변경 파일 목록 없음");
  }
  if (
    !last?.testResults.length &&
    !last?.unresolvedIssues.some((u) => u.includes("미실행") || u.includes("Bridge"))
  ) {
    missing.push("테스트 결과 또는 미실행 사유 없음");
  }
  return { allowed: missing.length === 0, missing };
}

export type CodeAgentWipTimelineActor = "ai_developer" | "code_agent" | "scm";

export type ImplementationWipDraftLifecycleTimelineAction =
  | "implementation_wip_draft_created"
  | "implementation_wip_draft_persisted"
  | "implementation_wip_draft_board_refreshed";

export function buildImplementationWipDraftLifecycleTimelineEntry(input: {
  readonly action: ImplementationWipDraftLifecycleTimelineAction;
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly selectedWorkItemCount: number;
  readonly bridgeEnabled: boolean;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    responseText: [
      `type=${input.action}`,
      `projectId=${input.projectId}`,
      `selectedTaskId=${input.selectedTaskId || "none"}`,
      `selectedWorkItemCount=${input.selectedWorkItemCount}`,
      `executionMode=stub`,
      `executionStatus=draft_created`,
      `bridgeEnabled=${input.bridgeEnabled ? "yes" : "no"}`,
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildCodeAgentWipTimelineEntry(input: {
  readonly action: string;
  readonly wip: CodeAgentWipExecutionV1;
  readonly taskIds?: readonly string[];
  readonly workItemIds?: readonly string[];
  readonly commitSha?: string;
  readonly actor: CodeAgentWipTimelineActor;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const last = input.wip.commits[input.wip.commits.length - 1];
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    responseText: [
      `type=${input.action}`,
      "mode=implementation",
      `provider=${input.wip.provider}`,
      `status=${input.wip.status}`,
      `branchName=${input.wip.branchName}`,
      `taskIds=${(input.taskIds ?? []).join(",") || last?.taskId || "none"}`,
      `workItemIds=${(input.workItemIds ?? input.wip.workItems).join(",") || "none"}`,
      `commitSha=${input.commitSha ?? last?.sha ?? "none"}`,
      `changedFiles=${(last?.changedFiles ?? []).slice(0, 5).join("|") || "none"}`,
      `testResults=${(last?.testResults ?? []).slice(0, 3).join("|") || "none"}`,
      `actor=${input.actor}`,
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export type LegacyCursorWipExecutionV1 = Readonly<{
  version: "cursor_wip_execution_v1";
  projectId: string;
  status: CodeAgentWipExecutionStatus;
  branchName: string;
  requestedAt: string;
  requestedBy: "ai_developer";
  workItems: readonly string[];
  commits: readonly (Omit<CodeAgentWipCommit, "provider"> & { provider?: CodeAgentProvider })[];
  developerReview?: Omit<CodeAgentDeveloperReview, "reviewedBy"> & { reviewedBy?: "ai_developer" };
  refactorRequests: readonly (Omit<CodeAgentRefactorRequest, "provider"> & { provider?: CodeAgentProvider })[];
}>;

export function normalizeLegacyCursorWipExecutionV1(legacy: LegacyCursorWipExecutionV1): CodeAgentWipExecutionV1 {
  const provider = inferCodeAgentProviderFromBranch(legacy.branchName);
  return {
    version: CODE_AGENT_WIP_EXECUTION_VERSION,
    projectId: legacy.projectId,
    provider,
    status: legacy.status,
    branchName: legacy.branchName,
    requestedAt: legacy.requestedAt,
    requestedBy: legacy.requestedBy,
    workItems: legacy.workItems,
    commits: legacy.commits.map((c) => ({
      sha: c.sha,
      provider: c.provider ?? inferCodeAgentProviderFromBranch(c.branchName) ?? provider,
      branchName: c.branchName,
      commitMessage: c.commitMessage,
      taskId: c.taskId,
      workItemId: c.workItemId,
      changedFiles: c.changedFiles,
      diffSummary: c.diffSummary,
      testResults: c.testResults,
      unresolvedIssues: c.unresolvedIssues,
      createdAt: c.createdAt,
    })),
    developerReview: legacy.developerReview
      ? {
          status: legacy.developerReview.status,
          reviewedAt: legacy.developerReview.reviewedAt,
          reviewedBy: "ai_developer",
          summary: legacy.developerReview.summary,
          findings: legacy.developerReview.findings,
          requestedActions: legacy.developerReview.requestedActions,
        }
      : undefined,
    refactorRequests: legacy.refactorRequests.map((r) => ({
      id: r.id,
      requestedAt: r.requestedAt,
      requestedBy: r.requestedBy,
      provider: r.provider ?? provider,
      reason: r.reason,
      instructions: r.instructions,
      targetCommitSha: r.targetCommitSha,
      status: r.status,
    })),
  };
}
