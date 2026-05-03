import { AsyncLocalStorage } from "node:async_hooks";

const projectAsyncLocalStorage = new AsyncLocalStorage<{ readonly projectId: string }>();

/**
 * 서버: 기본은 비프로덕션에서만 기록·조회. 운영에서 임시로 켤 때는 ENABLE_PROMPT_TIMELINE=1.
 */
export function isPromptTimelineDebugServer(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_PROMPT_TIMELINE === "1";
}

export function getPromptTimelineProjectId(): string | undefined {
  return projectAsyncLocalStorage.getStore()?.projectId;
}

export function runWithPromptTimelineProject<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const id = projectId.trim();
  if (!id || !isPromptTimelineDebugServer()) {
    return fn();
  }
  return projectAsyncLocalStorage.run({ projectId: id }, fn);
}
