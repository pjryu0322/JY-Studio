import { NextRequest, NextResponse } from "next/server";

export function resolveTaskCursorWorkerToken(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  return String(env.INTERNAL_WORKER_TOKEN ?? env.TASK_CURSOR_WORKER_TOKEN ?? "").trim();
}

export function isTaskCursorWorkerAuthorized(
  request: NextRequest,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  const expected = resolveTaskCursorWorkerToken(env);
  if (!expected) {
    return env.NODE_ENV !== "production";
  }
  const header = String(request.headers.get("x-task-cursor-worker-token") ?? "").trim();
  const auth = String(request.headers.get("authorization") ?? "").trim();
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return header === expected || bearer === expected;
}

export function requireTaskCursorWorkerAuth(
  request: NextRequest,
): NextResponse | null {
  if (isTaskCursorWorkerAuthorized(request)) return null;
  return NextResponse.json(
    { success: false, message: "Task Cursor worker 인증이 필요합니다." },
    { status: 401 },
  );
}
