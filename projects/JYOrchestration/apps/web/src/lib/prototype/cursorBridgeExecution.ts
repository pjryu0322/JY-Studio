import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  defaultForbiddenTargetPathGlobs,
  validateTargetRepositoryChangedFiles,
} from "@/lib/prototype/targetRepositoryPathGuard";

export type CursorSourceGenerationRequest = Readonly<{
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly selectedWorkItemIds: readonly string[];
  readonly workItems: readonly CursorWorkItem[];
  readonly targetRepository: ProjectTargetRepository;
  readonly branchName: string;
  readonly baseBranch: string;
  readonly workspaceRoot: string;
  readonly commitMessage: string;
  readonly prompt: string;
  readonly allowedPathGlobs: readonly string[];
  readonly forbiddenPathGlobs: readonly string[];
  readonly autoCommit: boolean;
  readonly autoPush: boolean;
  readonly autoPr: boolean;
  readonly cursorApiUrl?: string;
  readonly cursorApiToken?: string;
  readonly bridgeAdapter?: import("@/lib/prototype/cursorApiDirectExecution").CursorBridgeAdapter;
  /** @deprecated alias — use branchName */
  readonly workBranch?: string;
}>;

export type CursorBridgeExecuteRequest = CursorSourceGenerationRequest;

export type CursorBridgeExecuteResultStatus = "completed" | "failed" | "blocked";

export type CursorBridgeExecuteResult = Readonly<{
  readonly ok: boolean;
  readonly provider: "cursor";
  readonly status: CursorBridgeExecuteResultStatus;
  readonly selectedTaskId: string;
  readonly targetRepository?: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly pushed?: boolean;
  readonly prNumber?: number;
  readonly changedFiles?: readonly string[];
  readonly diffSummary?: readonly string[];
  readonly testResults?: readonly string[];
  readonly errorMessage?: string;
  readonly rawLog?: string;
  readonly workspacePath?: string;
  readonly pushStatus?: "success" | "skipped" | "failed";
  readonly pushErrorMessage?: string;
  readonly prStatus?: string;
  /** External Cursor API push reference — not platform SCM state. */
  readonly cursorExternalPushStatus?: string;
  readonly cursorExternalPrNumber?: number;
  readonly cursorExternalPrStatus?: string;
}>;

export type BridgeResultValidationContext = Readonly<{
  readonly targetRepository: ProjectTargetRepository;
  readonly allowedPathGlobs: readonly string[];
  readonly forbiddenPathGlobs?: readonly string[];
}>;

export function buildCursorSourceGenerationPrompt(input: {
  readonly selectedTaskId: string;
  readonly workItems: readonly CursorWorkItem[];
  readonly targetRepository: ProjectTargetRepository;
  readonly commitMessage: string;
  readonly allowedPathGlobs: readonly string[];
}): string {
  const sections = input.workItems.map((w) => {
    const lines = [
      `## Task ${w.taskId}`,
      w.title ? `제목: ${w.title}` : "",
      w.expectedOutput.length
        ? `기대 산출물:\n${w.expectedOutput.map((o) => `- ${o}`).join("\n")}`
        : "",
      w.testCommands.length ? `테스트 기준:\n${w.testCommands.map((t) => `- ${t}`).join("\n")}` : "",
      w.requiredFilesHint.length
        ? `예상 수정 위치:\n${w.requiredFilesHint.map((f) => `- ${f}`).join("\n")}`
        : "",
      w.prompt.trim() ? `구현 지시:\n${w.prompt.trim()}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  });

  const allowedLines = input.allowedPathGlobs.length
    ? input.allowedPathGlobs.map((g) => `- ${g}`)
    : ["- (제한 없음, 금지 경로만 적용)"];

  return [
    "# Cursor 소스 생성 요청",
    "",
    `프로젝트 저장소: ${input.targetRepository.repoFullName}`,
    `gitRepoUrl: ${input.targetRepository.gitRepoUrl}`,
    `selectedTaskId: ${input.selectedTaskId}`,
    `기본 브랜치: ${input.targetRepository.defaultBranch}`,
    "",
    ...sections,
    "",
    "## 허용 경로 (allowedPathGlobs)",
    ...allowedLines,
    "",
    "## Commit 메시지",
    input.commitMessage.trim(),
  ].join("\n");
}

export function buildCursorBridgeExecuteRequestFromWorkItems(input: {
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly selectedWorkItemIds: readonly string[];
  readonly workItems: readonly CursorWorkItem[];
  readonly targetRepository: ProjectTargetRepository;
  readonly branchName: string;
  readonly baseBranch: string;
  readonly workspaceRoot: string;
  readonly commitMessage: string;
  readonly allowedPathGlobs: readonly string[];
  readonly forbiddenPathGlobs?: readonly string[];
  readonly autoCommit: boolean;
  readonly autoPush: boolean;
  readonly autoPr: boolean;
  readonly cursorApiUrl?: string;
}):
  | CursorBridgeExecuteRequest
  | Readonly<{ readonly ok: false; readonly message: string }> {
  const scoped = input.workItems.filter((w) => w.taskId === input.selectedTaskId);
  if (!scoped.length) {
    return { ok: false, message: `${input.selectedTaskId}에 해당하는 Cursor WorkItem이 없습니다.` };
  }
  const selectedIds = new Set(input.selectedWorkItemIds);
  const workItems = scoped.filter((w) => selectedIds.has(w.id));
  if (!workItems.length) {
    return { ok: false, message: "선택된 workItem을 찾을 수 없습니다." };
  }
  const branchName = input.branchName.trim();
  if (!branchName) {
    return { ok: false, message: "branchName이 필요합니다." };
  }
  const workspaceRoot = input.workspaceRoot.trim();
  if (!workspaceRoot) {
    return { ok: false, message: "workspaceRoot가 필요합니다." };
  }
  const commitMessage = input.commitMessage.trim();
  if (!commitMessage) {
    return { ok: false, message: "commitMessage가 필요합니다." };
  }

  const allowedPathGlobs = input.allowedPathGlobs.map((g) => g.trim()).filter(Boolean);
  const forbiddenPathGlobs = [
    ...defaultForbiddenTargetPathGlobs(),
    ...(input.forbiddenPathGlobs ?? []).map((g) => g.trim()).filter(Boolean),
  ];

  const prompt = buildCursorSourceGenerationPrompt({
    selectedTaskId: input.selectedTaskId.trim(),
    workItems,
    targetRepository: input.targetRepository,
    commitMessage,
    allowedPathGlobs,
  });

  return {
    projectId: input.projectId.trim(),
    selectedTaskId: input.selectedTaskId.trim(),
    selectedWorkItemIds: workItems.map((w) => w.id),
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch.trim() || input.targetRepository.defaultBranch || "main",
    branchName,
    workBranch: branchName,
    workItems,
    workspaceRoot,
    commitMessage,
    prompt,
    allowedPathGlobs,
    forbiddenPathGlobs,
    autoCommit: input.autoCommit,
    // Push/PR are owned by platform SCM — never request them from Cursor API.
    autoPush: false,
    autoPr: false,
    ...(input.cursorApiUrl?.trim() ? { cursorApiUrl: input.cursorApiUrl.trim() } : {}),
  };
}

export function validateBridgeResultForRealSourceGeneration(
  result: CursorBridgeExecuteResult,
  context: BridgeResultValidationContext,
): Readonly<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  if (result.status === "blocked") {
    return { ok: false, reason: result.errorMessage ?? "Cursor API 실행이 차단되었습니다." };
  }
  if (!result.ok || result.status !== "completed") {
    return { ok: false, reason: result.errorMessage ?? "Cursor API 실행에 실패했습니다." };
  }
  const targetRepo = result.targetRepository?.trim() ?? "";
  if (!targetRepo || targetRepo !== context.targetRepository.repoFullName) {
    return { ok: false, reason: "대상 Git 저장소(targetRepository)가 응답과 일치하지 않습니다." };
  }
  const sha = result.commitSha?.trim() ?? "";
  if (!sha || sha.startsWith("wip-stub")) {
    return {
      ok: false,
      reason: "실제 git commit SHA가 없어 bridge_completed로 인정하지 않았습니다.",
    };
  }
  const files = (result.changedFiles ?? []).filter(Boolean);
  return validateTargetRepositoryChangedFiles({
    changedFiles: files,
    allowedPathGlobs: context.allowedPathGlobs,
    forbiddenPathGlobs: context.forbiddenPathGlobs,
  });
}

export function bridgeResultValidationContextFromRequest(
  request: CursorBridgeExecuteRequest,
): BridgeResultValidationContext {
  return {
    targetRepository: request.targetRepository,
    allowedPathGlobs: request.allowedPathGlobs,
    forbiddenPathGlobs: request.forbiddenPathGlobs,
  };
}

export function blockedCursorBridgeResult(input: {
  readonly selectedTaskId: string;
  readonly errorMessage: string;
  readonly rawLog?: string;
}): CursorBridgeExecuteResult {
  return {
    ok: false,
    provider: "cursor",
    status: "blocked",
    selectedTaskId: input.selectedTaskId,
    errorMessage: input.errorMessage,
    ...(input.rawLog ? { rawLog: input.rawLog } : {}),
  };
}

export function failedCursorBridgeResult(input: {
  readonly selectedTaskId: string;
  readonly errorMessage: string;
  readonly rawLog?: string;
  readonly branchName?: string;
  readonly targetRepository?: string;
  readonly changedFiles?: readonly string[];
}): CursorBridgeExecuteResult {
  return {
    ok: false,
    provider: "cursor",
    status: "failed",
    selectedTaskId: input.selectedTaskId,
    errorMessage: input.errorMessage,
    ...(input.branchName ? { branchName: input.branchName } : {}),
    ...(input.targetRepository ? { targetRepository: input.targetRepository } : {}),
    ...(input.changedFiles?.length ? { changedFiles: input.changedFiles } : {}),
    ...(input.rawLog ? { rawLog: input.rawLog } : {}),
  };
}
