import {
  blockedCursorBridgeResult,
  type CursorBridgeExecuteRequest,
  type CursorBridgeExecuteResult,
} from "@/lib/prototype/cursorBridgeExecution";
import { executeCursorApiDirectFromBridgeRequest } from "@/lib/prototype/cursorApiDirectExecution";
import {
  CURSOR_API_NOT_CONFIGURED_MESSAGE,
  CURSOR_API_TOKEN_MISSING_MESSAGE,
} from "@/lib/prototype/cursorExecutionAvailability";

/**
 * Implementation-stage source generation entry point.
 * Only Cursor API direct execution is supported; http_bridge/local_runner fallbacks are not used.
 */
export async function executeCursorBridgeWorkItem(
  request: CursorBridgeExecuteRequest,
  input?: {
    readonly cursorApiToken?: string;
  },
): Promise<CursorBridgeExecuteResult> {
  const cursorApiUrl = request.cursorApiUrl?.trim();
  if (!cursorApiUrl) {
    return blockedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      errorMessage: CURSOR_API_NOT_CONFIGURED_MESSAGE,
    });
  }

  const token = String(input?.cursorApiToken ?? request.cursorApiToken ?? "").trim();
  if (!token) {
    return blockedCursorBridgeResult({
      selectedTaskId: request.selectedTaskId,
      errorMessage: CURSOR_API_TOKEN_MISSING_MESSAGE,
    });
  }

  return executeCursorApiDirectFromBridgeRequest({
    request: { ...request, bridgeAdapter: "cursor_api", cursorApiUrl, cursorApiToken: token },
    cursorApiToken: token,
  });
}
