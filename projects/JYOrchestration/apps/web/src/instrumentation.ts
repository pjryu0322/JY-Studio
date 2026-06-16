export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const { ensureExecutionSetupSplitColumnsInDb } = await import(
      "@/lib/prisma/executionSetupSplitColumnsHeal"
    );
    await ensureExecutionSetupSplitColumnsInDb();
  } catch (error) {
    console.warn(
      "[instrumentation] execution_setups schema heal skipped:",
      error instanceof Error ? error.message : String(error),
    );
  }

  const { ensureTaskCursorEmbeddedWorkerStarted } = await import(
    "@/lib/prototype/taskCursorEmbeddedWorkerScheduler"
  );
  ensureTaskCursorEmbeddedWorkerStarted();
}
