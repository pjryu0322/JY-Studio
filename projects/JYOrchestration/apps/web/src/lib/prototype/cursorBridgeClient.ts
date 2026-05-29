import {
  blockedCursorBridgeResult,
  bridgeResultValidationContextFromRequest,
  failedCursorBridgeResult,
  type CursorBridgeExecuteRequest,
  type CursorBridgeExecuteResult,
  validateBridgeResultForRealSourceGeneration,
} from "@/lib/prototype/cursorBridgeExecution";
import { commitWorktreeChanges } from "@/lib/prototype/cursorBridgeGit";
import {
  ensureTargetRepositoryWorktree,
  prepareExecutionSetupWorkspace,
} from "@/lib/prototype/cursorBridgeTargetRepoGit";
import { getCursorBridgeAvailability } from "@/lib/prototype/cursorBridgeRuntime";
import type { CursorExecutionPayload } from "@/lib/integration/cursorExecutionTypes";
import { runCursorCliExecution } from "@/lib/integration/cursorExecutor";

const BRIDGE_FETCH_TIMEOUT_MS = 600_000;

function resolveGlobalPushKillSwitch(env: Record<string, string | undefined>): boolean {
  return String(env.GIT_APPLY_PUSH_ENABLED ?? "").trim().toLowerCase() === "true";
}

function normalizeHttpBridgeResult(
  request: CursorBridgeExecuteRequest,
  parsed: CursorBridgeExecuteResult,
): CursorBridgeExecuteResult {
  return {
    ...parsed,
    provider: "cursor",
    selectedTaskId: request.selectedTaskId,
    targetRepository: parsed.targetRepository ?? request.targetRepository.repoFullName,
    branchName: parsed.branchName ?? request.branchName,
    workspacePath: parsed.workspacePath ?? request.workspaceRoot,
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
    workspaceRoot: request.workspaceRoot,
    baseBranch: request.baseBranch,
    branchName: request.branchName,
    workBranch: request.branchName,
    prompt: request.prompt,
    workItems: request.workItems,
    commitMessage: request.commitMessage,
    selectedWorkItemIds: request.selectedWorkItemIds,
    allowedPathGlobs: request.allowedPathGlobs,
    forbiddenPathGlobs: request.forbiddenPathGlobs,
    autoCommit: request.autoCommit,
    autoPush: request.autoPush,
    autoPr: request.autoPr,
    cursorApiUrl: request.cursorApiUrl,
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
        branchName: request.branchName,
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
      branchName: request.branchName,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function executeLocalCursorBridge(
  request: CursorBridgeExecuteRequest,
  env: Record<string, string | undefined>,
): Promise<CursorBridgeExecuteResult> {
  const logs: string[] = ["[CURSOR_BRIDGE] mode=local_cli execution_setup_workspace"];
  const validationContext = bridgeResultValidationContextFromRequest(request);

  const workItem = request.workItems[0];
  if (!workItem) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: "실행할 workItem이 없습니다.",
    });
  }

  let workdir = request.workspaceRoot.trim();
  try {
    const prepared = await prepareExecutionSetupWorkspace({
      workdir,
      baseBranch: request.baseBranch,
      workBranch: request.branchName,
    });
    for (const line of prepared.log) logs.push(line);
  } catch (e) {
    logs.push(`[GIT] workspace prepare failed, trying clone fallback: ${e instanceof Error ? e.message : String(e)}`);
    const cloneParent = workdir.replace(/[\\/][^\\/]+$/, "") || workdir;
    const cloned = await ensureTargetRepositoryWorktree({
      cloneRoot: cloneParent,
      targetRepository: request.targetRepository,
      baseBranch: request.baseBranch,
      workBranch: request.branchName,
    });
    workdir = cloned.workdir;
    for (const line of cloned.log) logs.push(line);
  }

  const payload: CursorExecutionPayload = {
    taskId: request.selectedTaskId,
    taskPromptId: workItem.id,
    projectId: request.projectId,
    branchName: request.branchName,
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
      branchName: request.branchName,
    });
  }

  const changedFiles = cliResult.updatedFiles.map((f) => f.path.replace(/\\/g, "/")).filter(Boolean);
  if (!changedFiles.length) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: "변경 파일이 없어 실제 소스 생성으로 인정하지 않았습니다.",
      rawLog: logs.join("\n"),
      branchName: request.branchName,
    });
  }

  if (!request.autoCommit) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: "ExecutionSetup.autoCommit이 꺼져 있어 commit을 수행하지 않았습니다.",
      rawLog: logs.join("\n"),
      branchName: request.branchName,
      changedFiles,
    });
  }

  const pushKillSwitch = resolveGlobalPushKillSwitch(env);
  const gitResult = await commitWorktreeChanges({
    workdir,
    branchName: request.branchName,
    commitMessage: request.commitMessage,
    requestedPush: request.autoPush,
    pushEnabledEnv: pushKillSwitch,
  });
  logs.push(...gitResult.log);

  if (!gitResult.commitSha) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: "git commit SHA를 생성하지 못했습니다.",
      rawLog: logs.join("\n"),
      branchName: request.branchName,
    });
  }

  const files = gitResult.changedFiles.length ? gitResult.changedFiles : changedFiles;
  const result: CursorBridgeExecuteResult = {
    ok: true,
    provider: "cursor",
    status: "completed",
    selectedTaskId: request.selectedTaskId,
    targetRepository: request.targetRepository.repoFullName,
    branchName: request.branchName,
    workspacePath: request.workspaceRoot,
    commitSha: gitResult.commitSha,
    pushed: gitResult.pushed,
    changedFiles: files,
    diffSummary: [
      `대상 저장소 ${request.targetRepository.repoFullName} 변경 ${files.length}건`,
      `commit ${gitResult.commitSha.slice(0, 12)}`,
      `workspace: ${request.workspaceRoot}`,
    ],
    testResults: ["실제 pnpm test/build: Bridge 후 대상 저장소에서 실행 필요"],
    rawLog: logs.join("\n"),
  };

  const validation = validateBridgeResultForRealSourceGeneration(result, validationContext);
  if (!validation.ok) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: validation.reason,
      rawLog: logs.join("\n"),
      branchName: request.branchName,
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
  const validationContext = bridgeResultValidationContextFromRequest(request);

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
      const validation = validateBridgeResultForRealSourceGeneration(httpResult, validationContext);
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
    return executeLocalCursorBridge(request, env);
  }

  return blockedCursorBridgeResult({
    selectedTaskId: request.selectedTaskId,
    errorMessage: "지원되지 않는 Cursor Bridge 실행 모드입니다.",
  });
}
