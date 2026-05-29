import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { isPathUnderJyOrchestration } from "@/lib/prototype/cursorBridgeRuntime";

export type CursorBridgeExecuteRequest = Readonly<{
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly selectedWorkItemIds: readonly string[];
  readonly workItems: readonly CursorWorkItem[];
  readonly branchName: string;
  readonly baseBranch: string;
  readonly workspaceRoot: string;
  readonly commitMessage: string;
  readonly prompt: string;
  readonly forbiddenPaths?: readonly string[];
  readonly allowedPaths?: readonly string[];
}>;

export type CursorBridgeExecuteResultStatus = "completed" | "failed" | "blocked";

export type CursorBridgeExecuteResult = Readonly<{
  readonly ok: boolean;
  readonly provider: "cursor";
  readonly status: CursorBridgeExecuteResultStatus;
  readonly selectedTaskId: string;
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

export function buildCursorBridgeExecuteRequestFromWorkItems(input: {
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly selectedWorkItemIds: readonly string[];
  readonly workItems: readonly CursorWorkItem[];
  readonly branchName: string;
  readonly baseBranch: string;
  readonly workspaceRoot: string;
  readonly commitMessage: string;
}): CursorBridgeExecuteRequest | Readonly<{ readonly ok: false; readonly message: string }> {
  const scoped = input.workItems.filter((w) => w.taskId === input.selectedTaskId);
  if (!scoped.length) {
    return { ok: false, message: `${input.selectedTaskId}에 해당하는 Cursor WorkItem이 없습니다.` };
  }
  const selectedIds = new Set(input.selectedWorkItemIds);
  const workItems = scoped.filter((w) => selectedIds.has(w.id));
  if (!workItems.length) {
    return { ok: false, message: "선택된 workItem을 찾을 수 없습니다." };
  }
  const prompt = workItems.map((w) => w.prompt.trim()).filter(Boolean).join("\n\n---\n\n");
  if (!prompt.trim()) {
    return { ok: false, message: "Cursor WorkItem prompt가 비어 있습니다." };
  }
  return {
    projectId: input.projectId.trim(),
    selectedTaskId: input.selectedTaskId.trim(),
    selectedWorkItemIds: workItems.map((w) => w.id),
    workItems,
    branchName: input.branchName.trim(),
    baseBranch: input.baseBranch.trim() || "main",
    workspaceRoot: input.workspaceRoot.trim(),
    commitMessage: input.commitMessage.trim(),
    prompt,
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
  const outside = files.filter((f) => !isPathUnderJyOrchestration(f));
  if (outside.length) {
    return {
      ok: false,
      reason: `허용 범위 밖 변경 파일이 있습니다: ${outside.slice(0, 3).join(", ")}`,
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
}): CursorBridgeExecuteResult {
  return {
    ok: false,
    provider: "cursor",
    status: "failed",
    selectedTaskId: input.selectedTaskId,
    errorMessage: input.errorMessage,
    ...(input.branchName ? { branchName: input.branchName } : {}),
    ...(input.rawLog ? { rawLog: input.rawLog } : {}),
  };
}
