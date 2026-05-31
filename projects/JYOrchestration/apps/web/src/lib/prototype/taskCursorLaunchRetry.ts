import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { patchTaskCursorExecution, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import {
  buildTaskCursorOrchestrationPatch,
  buildTaskCursorApiFailedTimeline,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export function isTransientTaskCursorLaunchError(message: string | null | undefined): boolean {
  const m = String(message ?? "").trim().toLowerCase();
  if (!m) return false;
  return (
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    m.includes("econnrefused") ||
    m.includes("connection") ||
    m.includes("서버 연결이 끊어졌습니다") ||
    m.includes("hmr") ||
    m.includes("socket hang up") ||
    m.includes("aborted")
  );
}

export function formatTransientTaskCursorLaunchErrorMessage(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  if (isTransientTaskCursorLaunchError(raw)) {
    return "서버 연결이 끊어졌습니다. dev 서버 재컴파일/HMR 직후면 잠시 후 다시 시도해 주세요.";
  }
  return raw;
}

export async function postTaskCursorExecuteWithRetry(input: {
  readonly body: unknown;
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
}): Promise<Response> {
  const maxAttempts = input.maxAttempts ?? 3;
  const baseDelayMs = input.baseDelayMs ?? 2_000;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await credentialsIncludeFetch("/api/prototype/task-cursor/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.body),
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const canRetry = attempt < maxAttempts - 1 && isTransientTaskCursorLaunchError(message);
      if (!canRetry) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function buildTaskCursorLaunchTransientFailurePatch(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly message: string;
  readonly history?: readonly TaskCursorExecutionV1[] | null;
  readonly existingTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly nowIso?: string;
}) {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const deferred = patchTaskCursorExecution(input.execution, {
    status: "prompt_ready",
    failureReason: undefined,
    errorMessage: input.message,
    nowIso,
  });
  return buildTaskCursorOrchestrationPatch({
    execution: deferred,
    history: input.history,
    timelineEntries: [
      buildTaskCursorApiFailedTimeline({
        execution: patchTaskCursorExecution(deferred, {
          status: "cursor_failed",
          errorMessage: input.message,
          nowIso,
        }),
        nowIso,
      }),
    ],
    existingTimeline: input.existingTimeline,
  });
}
