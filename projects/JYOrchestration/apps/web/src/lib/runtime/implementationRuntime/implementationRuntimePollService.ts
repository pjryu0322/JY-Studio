import { runTaskCursorWorkerTick } from "@/lib/prototype/taskCursorWorkerService";

export type ImplementationRuntimePollTickResult = Readonly<{
  readonly processed: number;
  readonly results: Awaited<ReturnType<typeof runTaskCursorWorkerTick>>;
}>;

/** DB Run.nextPollAt 기준 due poll 1회. Cursor 상태는 진단용이며, Runtime 완료는 GitHub verify outcome으로만 확정된다. */
export async function pollDueImplementationRuntimeRuns(input: {
  readonly workerId: string;
  readonly projectId?: string | null;
  readonly limit?: number;
  readonly now?: Date;
}): Promise<ImplementationRuntimePollTickResult> {
  const results = await runTaskCursorWorkerTick({
    workerId: input.workerId,
    limit: input.limit ?? 1,
    projectId: input.projectId ?? null,
    now: input.now,
  });
  return { processed: results.length, results };
}

export async function pollDueImplementationRuntimeForProject(
  projectId: string,
): Promise<ImplementationRuntimePollTickResult> {
  return pollDueImplementationRuntimeRuns({
    workerId: "inline-recover",
    projectId,
    limit: 1,
  });
}
