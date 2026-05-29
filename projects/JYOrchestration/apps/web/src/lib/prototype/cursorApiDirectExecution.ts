import {
  executeCursorApiDirect,
  type CursorApiDirectExecuteRequest,
  type CursorApiDirectExecuteResult,
} from "@/lib/prototype/cursorApiDirectClient";
import type { CursorBridgeExecuteRequest, CursorBridgeExecuteResult } from "@/lib/prototype/cursorBridgeExecution";
import {
  failedCursorBridgeResult,
  validateBridgeResultForRealSourceGeneration,
  bridgeResultValidationContextFromRequest,
} from "@/lib/prototype/cursorBridgeExecution";
import type { CursorExecutionMode } from "@/lib/prototype/cursorExecutionAvailability";

export type CursorBridgeAdapter = "cursor_api" | "http_bridge" | "local_runner";

export function buildCursorApiDirectRequestFromBridgeRequest(
  request: CursorBridgeExecuteRequest,
  cursorApiToken: string,
): CursorApiDirectExecuteRequest {
  return {
    projectId: request.projectId,
    selectedTaskId: request.selectedTaskId,
    selectedWorkItemIds: request.selectedWorkItemIds,
    workItems: request.workItems,
    cursorApiUrl: request.cursorApiUrl!.trim(),
    cursorApiToken: cursorApiToken.trim(),
    targetRepository: request.targetRepository,
    workspacePath: request.workspaceRoot,
    baseBranch: request.baseBranch,
    branchName: request.branchName,
    commitMessage: request.commitMessage,
    prompt: request.prompt,
    autoCommit: request.autoCommit,
    autoPush: request.autoPush,
    autoPr: request.autoPr,
    allowedPathGlobs: request.allowedPathGlobs,
  };
}

export function mapCursorApiDirectResultToBridgeResult(
  request: CursorBridgeExecuteRequest,
  result: CursorApiDirectExecuteResult,
): CursorBridgeExecuteResult {
  if (result.status === "unsupported") {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: result.errorMessage ?? "Cursor API 직접 실행 endpoint가 지원되지 않습니다.",
      rawLog: result.rawLog,
      branchName: request.branchName,
    });
  }
  if (result.status === "blocked") {
    return {
      ok: false,
      provider: "cursor",
      status: "blocked",
      selectedTaskId: request.selectedTaskId,
      errorMessage: result.errorMessage ?? "Cursor API 실행이 차단되었습니다.",
      rawLog: result.rawLog,
    };
  }
  if (!result.ok || result.status !== "completed") {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: result.errorMessage ?? "Cursor API 호출에 실패했습니다.",
      rawLog: result.rawLog,
      branchName: request.branchName,
      changedFiles: result.changedFiles,
    });
  }

  const bridgeResult: CursorBridgeExecuteResult = {
    ok: true,
    provider: "cursor",
    status: "completed",
    selectedTaskId: request.selectedTaskId,
    targetRepository: result.targetRepository ?? request.targetRepository.repoFullName,
    branchName: result.branchName ?? request.branchName,
    workspacePath: result.workspacePath ?? request.workspaceRoot,
    commitSha: result.commitSha,
    changedFiles: result.changedFiles ?? [],
    diffSummary: result.diffSummary ?? [],
    testResults: result.testResults ?? [],
    pushed: result.pushed,
    ...(result.prNumber !== undefined ? { prNumber: result.prNumber } : {}),
    ...(result.pushStatus ? { pushStatus: result.pushStatus } : {}),
    ...(result.pushErrorMessage ? { pushErrorMessage: result.pushErrorMessage } : {}),
    ...(result.prStatus ? { prStatus: result.prStatus } : {}),
    rawLog: result.rawLog,
  };

  const validation = validateBridgeResultForRealSourceGeneration(
    bridgeResult,
    bridgeResultValidationContextFromRequest(request),
  );
  if (!validation.ok) {
    return failedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      targetRepository: request.targetRepository.repoFullName,
      errorMessage: validation.reason,
      rawLog: result.rawLog,
      branchName: bridgeResult.branchName,
      changedFiles: bridgeResult.changedFiles,
    });
  }

  return bridgeResult;
}

export async function executeCursorApiDirectFromBridgeRequest(input: {
  readonly request: CursorBridgeExecuteRequest;
  readonly cursorApiToken: string;
}): Promise<CursorBridgeExecuteResult> {
  const directRequest = buildCursorApiDirectRequestFromBridgeRequest(
    input.request,
    input.cursorApiToken,
  );
  const directResult = await executeCursorApiDirect(directRequest);
  return mapCursorApiDirectResultToBridgeResult(input.request, directResult);
}

export function resolveCursorBridgeAdapter(mode: CursorExecutionMode): CursorBridgeAdapter | null {
  if (mode === "cursor_api") return "cursor_api";
  if (mode === "http_bridge") return "http_bridge";
  if (mode === "local_runner") return "local_runner";
  return null;
}
