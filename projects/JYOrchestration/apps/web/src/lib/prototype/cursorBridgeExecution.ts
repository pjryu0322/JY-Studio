import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { isPlatformInternalSourcePath } from "@/lib/prototype/cursorBridgeRuntime";

export type CursorSourceGenerationRequest = Readonly<{
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly selectedWorkItemIds: readonly string[];
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly workBranch: string;
  readonly prompt: string;
  readonly workItems: readonly CursorWorkItem[];
  readonly commitMessage: string;
  readonly allowedTargetPaths?: readonly string[];
  readonly forbiddenTargetPaths?: readonly string[];
  /** Local clone/checkout only. */
  readonly workspaceRoot?: string;
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
}>;

export function buildCursorSourceGenerationPrompt(input: {
  readonly selectedTaskId: string;
  readonly workItems: readonly CursorWorkItem[];
  readonly targetRepository: ProjectTargetRepository;
  readonly commitMessage: string;
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

  return [
    "# Cursor 소스 생성 요청",
    "",
    `프로젝트 저장소: ${input.targetRepository.repoFullName}`,
    `selectedTaskId: ${input.selectedTaskId}`,
    `기본 브랜치: ${input.targetRepository.defaultBranch}`,
    "",
    ...sections,
    "",
    "## 금지 경로",
    "- projects/JYOrchestration/** (플랫폼 내부)",
    "- apps/web/src/generated/implementation-wip/**",
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
  readonly workBranch: string;
  readonly baseBranch: string;
  readonly commitMessage: string;
  readonly workspaceRoot?: string;
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
  const workBranch = input.workBranch.trim();
  if (!workBranch) {
    return { ok: false, message: "workBranch가 필요합니다." };
  }
  const commitMessage = input.commitMessage.trim();
  if (!commitMessage) {
    return { ok: false, message: "commitMessage가 필요합니다." };
  }
  const prompt = buildCursorSourceGenerationPrompt({
    selectedTaskId: input.selectedTaskId.trim(),
    workItems,
    targetRepository: input.targetRepository,
    commitMessage,
  });
  return {
    projectId: input.projectId.trim(),
    selectedTaskId: input.selectedTaskId.trim(),
    selectedWorkItemIds: workItems.map((w) => w.id),
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch.trim() || input.targetRepository.defaultBranch || "main",
    workBranch,
    workItems,
    commitMessage,
    prompt,
    forbiddenTargetPaths: ["projects/JYOrchestration/**", "apps/web/src/generated/implementation-wip/**"],
    ...(input.workspaceRoot?.trim() ? { workspaceRoot: input.workspaceRoot.trim() } : {}),
  };
}

export function validateBridgeResultForRealSourceGeneration(
  result: CursorBridgeExecuteResult,
): Readonly<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  if (result.status === "blocked") {
    return { ok: false, reason: result.errorMessage ?? "Cursor Bridge 실행이 차단되었습니다." };
  }
  if (!result.ok || result.status !== "completed") {
    return { ok: false, reason: result.errorMessage ?? "Cursor Bridge 실행에 실패했습니다." };
  }
  const targetRepo = result.targetRepository?.trim() ?? "";
  if (!targetRepo) {
    return { ok: false, reason: "대상 Git 저장소(targetRepository)가 응답에 없습니다." };
  }
  const sha = result.commitSha?.trim() ?? "";
  if (!sha || sha.startsWith("wip-stub")) {
    return {
      ok: false,
      reason: "실제 git commit SHA가 없어 bridge_completed로 인정하지 않았습니다.",
    };
  }
  const files = (result.changedFiles ?? []).filter(Boolean);
  if (!files.length) {
    return {
      ok: false,
      reason: "변경 파일이 없어 실제 소스 생성으로 인정하지 않았습니다.",
    };
  }
  const platformPaths = files.filter((f) => isPlatformInternalSourcePath(f));
  if (platformPaths.length) {
    return {
      ok: false,
      reason: `플랫폼 내부 경로 변경은 실제 소스 생성으로 인정하지 않습니다: ${platformPaths.slice(0, 3).join(", ")}`,
    };
  }
  return { ok: true };
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
