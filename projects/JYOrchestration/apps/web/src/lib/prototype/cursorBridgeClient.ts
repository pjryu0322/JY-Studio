import {
  blockedCursorBridgeResult,
  failedCursorBridgeResult,
  type CursorBridgeExecuteRequest,
  type CursorBridgeExecuteResult,
  validateBridgeResultForRealSourceGeneration,
} from "@/lib/prototype/cursorBridgeExecution";
import { commitWorktreeChanges } from "@/lib/prototype/cursorBridgeGit";
import {
  getCursorBridgeAvailability,
  resolveCursorBridgeCloneRoot,
  type CursorBridgeAvailability,
} from "@/lib/prototype/cursorBridgeRuntime";
import { ensureTargetRepositoryWorktree } from "@/lib/prototype/cursorBridgeTargetRepoGit";
import type { CursorExecutionPayload } from "@/lib/integration/cursorExecutionTypes";
import { runCursorCliExecution } from "@/lib/integration/cursorExecutor";

const BRIDGE_FETCH_TIMEOUT_MS = 600_000;

function normalizeHttpBridgeResult(
  request: CursorBridgeExecuteRequest,
  parsed: CursorBridgeExecuteResult,
): CursorBridgeExecuteResult {
  return {
    ...parsed,
    provider: "cursor",
    selectedTaskId: request.selectedTaskId,
    targetRepository: parsed.targetRepository ?? request.targetRepository.repoFullName,
    branchName: parsed.branchName ?? request.workBranch,
  };
}

async function fetchHttpBridge(
  endpoint: string,
  token: string | undefined,
  request: CursorBridgeExecuteRequest,
): Promise<CursorBridgeExecuteResult> {
  const url = `${endpoint.replace(/\/+$/, "")}/execute`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  const body = {
    projectId: request.projectId,
    selectedTaskId: request.selectedTaskId,
    targetRepository: request.targetRepository,
    baseBranch: request.baseBranch,
    workBranch: request.workBranch,
    prompt: request.prompt,
    workItems: request.workItems,
    commitMessage: request.commitMessage,
    selectedWorkItemIds: request.selectedWorkItemIds,
    forbiddenTargetPaths: request.forbiddenTargetPaths,
    allowedTargetPaths: request.allowedTargetPaths,
  };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), BRIDGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      return failedCursorBridgeResult({
        selectedTaskId: request.selectedTaskId,
        targetRepository: request.targetRepository.repoFullName,
        errorMessage: `Cursor Bridge HTTP ${res.status}: ${text.slice(0, 500)}`,
        rawLog: text,
        branchName: request.workBranch,
      });
    }
    const parsed = JSON.parse(text) as CursorBridgeExecuteResult;
    return normalizeHttpBridgeResult(request, parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: `Cursor Bridge HTTP 호출 실패: ${msg}`,
      branchName: request.workBranch,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function executeLocalCursorBridge(
  request: CursorBridgeExecuteRequest,
  availability: CursorBridgeAvailability,
  env: Record<string, string | undefined>,
): Promise<CursorBridgeExecuteResult> {
  const logs: string[] = ["[CURSOR_BRIDGE] mode=local_cli target_repo"];
  const cloneRoot = resolveCursorBridgeCloneRoot(env) ?? availability.workspaceRoot ?? request.workspaceRoot;
  if (!cloneRoot) {
    return blockedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      errorMessage: "대상 저장소 clone root가 설정되지 않았습니다.",
    });
  }

  const workItem = request.workItems[0];
  if (!workItem) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: "실행할 workItem이 없습니다.",
    });
  }

  let workdir: string;
  try {
    const prepared = await ensureTargetRepositoryWorktree({
      cloneRoot,
      targetRepository: request.targetRepository,
      baseBranch: request.baseBranch,
      workBranch: request.workBranch,
    });
    workdir = prepared.workdir;
    for (const line of prepared.log) logs.push(line);
  } catch (e) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: `대상 저장소 worktree 준비 실패: ${e instanceof Error ? e.message : String(e)}`,
      rawLog: logs.join("\n"),
      branchName: request.workBranch,
    });
  }

  const payload: CursorExecutionPayload = {
    taskId: request.selectedTaskId,
    taskPromptId: workItem.id,
    projectId: request.projectId,
    branchName: request.workBranch,
    prompt: request.prompt,
    context: {
      files: [...workItem.requiredFilesHint],
      commitMessage: request.commitMessage,
    },
  };

  const prevWorkdir = process.env.CURSOR_WORKDIR;
  process.env.CURSOR_WORKDIR = workdir;
  let cliResult;
  try {
    cliResult = await runCursorCliExecution(payload);
  } finally {
    if (prevWorkdir === undefined) delete process.env.CURSOR_WORKDIR;
    else process.env.CURSOR_WORKDIR = prevWorkdir;
  }

  logs.push(...cliResult.logs);
  if (!cliResult.success) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: cliResult.error ?? "Cursor CLI 실행 실패",
      rawLog: logs.join("\n"),
      branchName: request.workBranch,
    });
  }

  const changedFiles = cliResult.updatedFiles.map((f) => f.path.replace(/\\/g, "/")).filter(Boolean);
  if (!changedFiles.length) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: "변경 파일이 없어 실제 소스 생성으로 인정하지 않았습니다.",
      rawLog: logs.join("\n"),
      branchName: request.workBranch,
    });
  }

  const gitResult = await commitWorktreeChanges({
    workdir,
    branchName: request.workBranch,
    commitMessage: request.commitMessage,
    requestedPush: true,
    pushEnabledEnv: String(env.GIT_APPLY_PUSH_ENABLED ?? "").trim().toLowerCase() === "true",
  });
  logs.push(...gitResult.log);

  if (!gitResult.commitSha) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: "git commit SHA를 생성하지 못했습니다.",
      rawLog: logs.join("\n"),
      branchName: request.workBranch,
    });
  }

  const files = gitResult.changedFiles.length ? gitResult.changedFiles : changedFiles;
  const result: CursorBridgeExecuteResult = {
    ok: true,
    provider: "cursor",
    status: "completed",
    selectedTaskId: request.selectedTaskId,
    targetRepository: request.targetRepository.repoFullName,
    branchName: request.workBranch,
    commitSha: gitResult.commitSha,
    pushed: gitResult.pushed,
    changedFiles: files,
    diffSummary: [
      `대상 저장소 ${request.targetRepository.repoFullName} 변경 ${files.length}건`,
      `commit ${gitResult.commitSha.slice(0, 12)}`,
    ],
    testResults: ["실제 pnpm test/build: Bridge 후 대상 저장소에서 실행 필요"],
    rawLog: logs.join("\n"),
  };

  const validation = validateBridgeResultForRealSourceGeneration(result);
  if (!validation.ok) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: validation.reason,
      rawLog: logs.join("\n"),
      branchName: request.workBranch,
      changedFiles: files,
    });
  }

  return result;
}

export async function executeCursorBridgeWorkItem(
  request: CursorBridgeExecuteRequest,
  input?: {
    readonly env?: Record<string, string | undefined>;
  },
): Promise<CursorBridgeExecuteResult> {
  const env = input?.env ?? (process.env as Record<string, string | undefined>);
  const availability = getCursorBridgeAvailability({ env });

  if (!availability.available) {
    return blockedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      errorMessage: availability.reason,
    });
  }

  if (availability.mode === "http" && availability.endpoint) {
    const token = String(env.CURSOR_BRIDGE_TOKEN ?? "").trim() || undefined;
    const httpResult = await fetchHttpBridge(availability.endpoint, token, request);
    if (httpResult.ok && httpResult.status === "completed") {
      const validation = validateBridgeResultForRealSourceGeneration(httpResult);
      if (!validation.ok) {
        return failedCursorBridgeResult({
          selectedTaskId: request.selectedTaskId,
          targetRepository: request.targetRepository.repoFullName,
          errorMessage: validation.reason,
          rawLog: httpResult.rawLog,
          branchName: httpResult.branchName,
          changedFiles: httpResult.changedFiles,
        });
      }
    }
    return httpResult;
  }

  if (availability.mode === "local_cli") {
    return executeLocalCursorBridge(request, availability, env);
  }

  return blockedCursorBridgeResult({
    selectedTaskId: request.selectedTaskId,
    errorMessage: "지원되지 않는 Cursor Bridge 실행 모드입니다.",
  });
}
