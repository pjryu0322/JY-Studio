import { prisma } from "@/lib/prisma";
import { transitionImplementationCodeTaskRun } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import type { RuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { isRuntimeInFlight } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

const REDISPATCHABLE: ReadonlySet<RuntimeState> = new Set([
  "dispatching",
  "cursor_running",
  "github_verifying",
]);

async function resetRunToQueued(input: {
  readonly runId: string;
  readonly runtimeState: RuntimeState;
  readonly now: Date;
}): Promise<void> {
  const { runId, runtimeState, now } = input;
  if (runtimeState === "queued") return;
  if (runtimeState === "dispatching") {
    await transitionImplementationCodeTaskRun({
      runId,
      toState: "failed",
      patch: { failureReason: "dispatch_reconcile_reset" },
      now,
    });
    await transitionImplementationCodeTaskRun({
      runId,
      toState: "queued",
      patch: { failureReason: null },
      now,
    });
    return;
  }
  if (runtimeState === "failed" || runtimeState === "stale") {
    await transitionImplementationCodeTaskRun({
      runId,
      toState: "queued",
      patch: { failureReason: null },
      now,
    });
    return;
  }
  if (REDISPATCHABLE.has(runtimeState)) {
    await transitionImplementationCodeTaskRun({
      runId,
      toState: "failed",
      patch: { failureReason: "dispatch_reconcile_reset" },
      now,
    });
    await transitionImplementationCodeTaskRun({
      runId,
      toState: "queued",
      patch: { failureReason: null },
      now,
    });
  }
}

/** Run이 in-flight인데 Cursor agent가 없으면 queued로 되돌려 재디스패치 가능하게 한다. */
export async function reconcileImplementationRunBeforeDispatch(input: {
  readonly jobId: string;
  readonly codeTaskId: string;
  readonly now?: Date;
}): Promise<boolean> {
  const jobId = input.jobId.trim();
  const codeTaskId = input.codeTaskId.trim();
  const now = input.now ?? new Date();
  const run = await prisma.implementationCodeTaskRun.findFirst({
    where: { jobId, codeTaskId },
    orderBy: { updatedAt: "desc" },
  });
  if (!run) return false;

  const state = run.runtimeState as RuntimeState;
  if (!isRuntimeInFlight(state) && state !== "dispatching") {
    return false;
  }

  const agentId = String(run.cursorAgentId ?? "").trim();
  if ((state === "cursor_running" || state === "github_verifying") && agentId) {
    return false;
  }

  await resetRunToQueued({ runId: run.id, runtimeState: state, now });
  return true;
}

export async function assertRunDispatchAllowed(input: {
  readonly jobId: string;
  readonly codeTaskId: string;
}): Promise<void> {
  const jobId = input.jobId.trim();
  const codeTaskId = input.codeTaskId.trim();
  await reconcileImplementationRunBeforeDispatch({ jobId, codeTaskId });

  const run = await prisma.implementationCodeTaskRun.findFirst({
    where: { jobId, codeTaskId },
    orderBy: { updatedAt: "desc" },
  });
  if (!run) {
    throw new Error(
      `DB Run not found for dispatch: jobId=${jobId}, codeTaskId=${codeTaskId}`,
    );
  }
  const state = run.runtimeState as RuntimeState;
  if (isRuntimeInFlight(state)) {
    throw new Error(`Duplicate dispatch blocked: run ${state}`);
  }
  if (state !== "queued") {
    throw new Error(`Dispatch only allowed from queued (runState=${state})`);
  }
}
