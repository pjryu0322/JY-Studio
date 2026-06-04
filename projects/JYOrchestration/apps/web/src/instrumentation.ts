export async function register() {
  const { ensureTaskCursorEmbeddedWorkerStarted } = await import(
    "@/lib/prototype/taskCursorEmbeddedWorkerScheduler"
  );
  ensureTaskCursorEmbeddedWorkerStarted();
}
