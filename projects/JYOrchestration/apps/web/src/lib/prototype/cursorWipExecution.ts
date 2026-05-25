import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { IMPLEMENTATION_MODE_PRIMARY_MEMBERS } from "@/lib/requirements/modeOrchestrationConfig";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export const CURSOR_WIP_EXECUTION_VERSION = "cursor_wip_execution_v1" as const;

export const CURSOR_WIP_WORK_REQUEST_CHIP = "Cursor WIP 작업 요청";
/** @deprecated — 이전 칩 라벨; WIP 요청과 동일하게 라우팅 */
export const LEGACY_CURSOR_EXECUTION_REQUEST_CHIP = "Cursor 실행 요청";

export const CURSOR_WIP_POLICY_SECTION = `## WIP 작업 정책

- 이 작업은 검토용 WIP 작업이다.
- main 브랜치에 직접 반영하지 않는다.
- 공식 push/PR/merge를 수행하지 않는다.
- WIP branch에서만 작업한다.
- 작업 완료 후 WIP commit을 생성한다.
- 변경 파일 목록, diff 요약, 테스트 결과, 미해결 이슈를 보고한다.
- AI개발자 승인 전에는 공식 반영 대상으로 보지 않는다.`;

export type CursorWipExecutionStatus =
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

export type CursorWipCommit = Readonly<{
  sha?: string;
  branchName: string;
  commitMessage: string;
  taskId: string;
  workItemId: string;
  changedFiles: readonly string[];
  diffSummary: readonly string[];
  testResults: readonly string[];
  unresolvedIssues: readonly string[];
  createdAt: string;
}>;

export type CursorDeveloperReviewStatus = "pending" | "approved" | "refactor_requested" | "rejected";

export type CursorDeveloperReview = Readonly<{
  status: CursorDeveloperReviewStatus;
  reviewedAt: string;
  summary: string;
  findings: readonly string[];
  requestedActions: readonly string[];
}>;

export type CursorRefactorRequest = Readonly<{
  id: string;
  requestedAt: string;
  requestedBy: "ai_developer";
  reason: string;
  instructions: string;
  targetCommitSha?: string;
  status: "requested" | "applied" | "cancelled";
}>;

export type CursorWipExecutionV1 = Readonly<{
  version: typeof CURSOR_WIP_EXECUTION_VERSION;
  projectId: string;
  status: CursorWipExecutionStatus;
  branchName: string;
  requestedAt: string;
  requestedBy: "ai_developer";
  workItems: readonly string[];
  commits: readonly CursorWipCommit[];
  developerReview?: CursorDeveloperReview;
  refactorRequests: readonly CursorRefactorRequest[];
}>;

export function cursorIsNotSingleChatMember(): boolean {
  return !IMPLEMENTATION_MODE_PRIMARY_MEMBERS.some((id) => String(id).toLowerCase().includes("cursor"));
}

export function buildWipBranchName(projectId: string, primaryTaskId: string): string {
  const pid = projectId.trim().replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 24);
  const tid = primaryTaskId.trim().replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 32);
  return `wip/cursor/${tid || pid || "task"}`;
}

export function buildWipCommitMessage(taskTitle: string, refactor = false): string {
  const title = taskTitle.trim() || "implementation task";
  return refactor ? `wip(cursor): refactor ${title}` : `wip(cursor): ${title}`;
}

export function appendWipPolicyToCursorPrompt(prompt: string): string {
  if (prompt.includes("## WIP 작업 정책")) return prompt;
  return `${prompt.trim()}\n\n${CURSOR_WIP_POLICY_SECTION}\n`;
}

export function buildInitialCursorWipExecution(input: {
  readonly projectId: string;
  readonly plan: ImplementationTaskPlanV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly nowIso?: string;
}): CursorWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const primaryTask = input.plan.items[0];
  const branchName = buildWipBranchName(input.projectId, primaryTask?.id ?? "bundle");
  return {
    version: CURSOR_WIP_EXECUTION_VERSION,
    projectId: input.projectId.trim(),
    status: "requested",
    branchName,
    requestedAt: now,
    requestedBy: "ai_developer",
    workItems: input.workItems.map((w) => w.id),
    commits: [],
    refactorRequests: [],
  };
}

export function buildStubCursorWipCommit(input: {
  readonly wip: CursorWipExecutionV1;
  readonly plan: ImplementationTaskPlanV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly nowIso?: string;
}): CursorWipCommit {
  const now = input.nowIso ?? new Date().toISOString();
  const item = input.plan.items[0];
  const workItem = input.workItems[0];
  const hints = item?.executionHints;
  const changedFiles = [
    ...(hints?.candidateFiles.slice(0, 3) ?? []),
    ...(workItem?.requiredFilesHint.slice(0, 2) ?? []),
  ].filter(Boolean);
  return {
    sha: `wip-stub-${now.replace(/[:.]/g, "")}`,
    branchName: input.wip.branchName,
    commitMessage: buildWipCommitMessage(item?.title ?? "implementation", false),
    taskId: item?.id ?? "unknown",
    workItemId: workItem?.id ?? "unknown",
    changedFiles: changedFiles.length ? changedFiles : ["projects/JYOrchestration/apps/web/src/lib/prototype/ (stub)"],
    diffSummary: [
      "WIP 초안: 기획 범위 내 구현 스켈레톤 반영 (stub, 실제 diff는 다음 bridge 단계)",
      "테스트·타입 정합성 점검 대기",
    ],
    testResults: [
      "pnpm test -- implementation (stub: passed)",
      "pnpm build (stub: pending local run)",
    ],
    unresolvedIssues: ["실제 Cursor bridge 연결 전 — 공식 push/PR/merge 미수행"],
    createdAt: now,
  };
}

export function applyStubWipCommitToExecution(
  wip: CursorWipExecutionV1,
  commit: CursorWipCommit,
): CursorWipExecutionV1 {
  return {
    ...wip,
    status: "developer_reviewing",
    commits: [...wip.commits, commit],
    developerReview: {
      status: "pending",
      reviewedAt: commit.createdAt,
      summary: "Cursor WIP commit 결과 검토 대기",
      findings: commit.unresolvedIssues,
      requestedActions: [],
    },
  };
}

export function buildCursorWipRequestedMessage(input: {
  readonly wip: CursorWipExecutionV1;
  readonly plan: ImplementationTaskPlanV1;
  readonly nowIso?: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const taskLines = input.plan.items.map((t, i) => `${i + 1}. ${t.title}`).join("\n");
  return newRequirementsMessage({
    id: `cursor-wip-requested-${input.wip.requestedAt}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "Cursor WIP 작업을 요청했습니다.",
      "",
      "실행 도구: Cursor (SingleChat 멤버가 아닌 Code Agent)",
      "",
      `WIP branch: \`${input.wip.branchName}\``,
      "",
      "대상 task:",
      taskLines,
      "",
      "정책: WIP branch에서만 작업하며, 공식 push/PR/merge는 수행하지 않습니다. AI개발자 승인 후 SCM이 공식 반영합니다.",
    ].join("\n"),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: "CURSOR_WIP_REQUESTED_V1",
      serviceDesignStage: "implementation",
      interviewAllowCustomInput: true,
    },
  });
}

export const CURSOR_WIP_REVIEW_CHIPS = [
  "변경사항 보기",
  "리팩토링 요청",
  "추가 수정 요청",
  "구현 결과 승인",
  "작업 폐기",
] as const;

export function buildCursorWipReviewMessage(input: {
  readonly wip: CursorWipExecutionV1;
  readonly commit: CursorWipCommit;
  readonly nowIso?: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  return newRequirementsMessage({
    id: `cursor-wip-review-${input.commit.createdAt}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "Cursor가 WIP 작업을 완료했습니다. (실행 도구: Cursor)",
      "",
      "브랜치:",
      `- ${input.commit.branchName}`,
      "",
      "WIP Commit:",
      `- ${input.commit.commitMessage}`,
      input.commit.sha ? `- sha: ${input.commit.sha}` : "",
      "",
      "변경 파일:",
      ...input.commit.changedFiles.map((f) => `- ${f}`),
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
      internalType: "CURSOR_WIP_REVIEW_V1",
      serviceDesignStage: "implementation",
      interviewSuggestions: [...CURSOR_WIP_REVIEW_CHIPS],
      interviewAllowCustomInput: true,
    },
  });
}

export function buildDeveloperApprovedMessage(input: {
  readonly wip: CursorWipExecutionV1;
  readonly nowIso?: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const last = input.wip.commits[input.wip.commits.length - 1];
  return newRequirementsMessage({
    id: `cursor-wip-dev-approved-${input.nowIso ?? new Date().toISOString()}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "구현 결과를 승인했습니다.",
      "",
      `승인 WIP commit: ${last?.commitMessage ?? "(없음)"}`,
      "이 WIP 결과는 공식 반영 전 검토용입니다.",
      "",
      "다음 단계: SCM에게 공식 반영을 요청해 주세요. (push/PR/merge는 SCM만 수행)",
    ].join("\n"),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: "CURSOR_WIP_DEV_APPROVED_V1",
      serviceDesignStage: "implementation",
      interviewSuggestions: ["SCM에게 공식 반영 요청"],
      interviewAllowCustomInput: true,
    },
  });
}

export function buildScmOfficialCommitPendingMessage(input: {
  readonly wip: CursorWipExecutionV1;
  readonly nowIso?: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("memo");
  const last = input.wip.commits[input.wip.commits.length - 1];
  return newRequirementsMessage({
    id: `cursor-wip-scm-pending-${input.nowIso ?? new Date().toISOString()}`,
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
      "Cursor는 공식 push/PR/merge를 수행하지 않습니다.",
    ].join("\n"),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: "CURSOR_WIP_SCM_PENDING_V1",
      serviceDesignStage: "implementation",
      interviewAllowCustomInput: true,
    },
  });
}

export function evaluateDeveloperApprovalGate(wip: CursorWipExecutionV1 | null | undefined): Readonly<{
  allowed: boolean;
  missing: readonly string[];
}> {
  const missing: string[] = [];
  if (!wip) {
    missing.push("Cursor WIP 실행 상태 없음");
    return { allowed: false, missing };
  }
  const okStatus = new Set<CursorWipExecutionStatus>([
    "wip_committed",
    "wip_updated",
    "developer_reviewing",
    "refactor_requested",
  ]);
  if (!okStatus.has(wip.status)) missing.push(`현재 상태(${wip.status})에서는 승인 불가`);
  if (!wip.commits.length) missing.push("WIP commit 없음");
  const last = wip.commits[wip.commits.length - 1];
  if (!last?.changedFiles.length) missing.push("변경 파일 목록 없음");
  if (!last?.testResults.length && !last?.unresolvedIssues.some((u) => u.includes("미실행"))) {
    missing.push("테스트 결과 또는 미실행 사유 없음");
  }
  return { allowed: missing.length === 0, missing };
}

export function buildCursorWipTimelineEntry(input: {
  readonly action: string;
  readonly wip: CursorWipExecutionV1;
  readonly taskIds?: readonly string[];
  readonly workItemIds?: readonly string[];
  readonly commitSha?: string;
  readonly actor: "ai_developer" | "cursor_tool" | "scm";
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
