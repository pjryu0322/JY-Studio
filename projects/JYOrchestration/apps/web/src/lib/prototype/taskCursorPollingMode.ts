export type TaskCursorPollingMode = "server" | "client";

export function resolveTaskCursorPollingMode(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): TaskCursorPollingMode {
  const raw = String(
    env.NEXT_PUBLIC_TASK_CURSOR_POLLING_MODE ?? env.TASK_CURSOR_POLLING_MODE ?? "",
  )
    .trim()
    .toLowerCase();
  if (raw === "client") return "client";
  return "server";
}

export function isServerTaskCursorPolling(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return resolveTaskCursorPollingMode(env) === "server";
}
