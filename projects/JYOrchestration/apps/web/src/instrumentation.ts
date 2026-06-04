export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { ensureTaskCursorEmbeddedWorkerStarted } = await import(
    "@/lib/prototype/taskCursorEmbeddedWorkerScheduler"
  );
  ensureTaskCursorEmbeddedWorkerStarted();
}
