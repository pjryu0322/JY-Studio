import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { randomUuid } from "@/lib/platform-orchestration/platformIds";
import type { ImplementationRuntimeRunView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export type CodeTaskRunIdentitySplit = Readonly<{
  readonly codeTaskId: string;
  readonly canonicalRunId: string;
  readonly observedRunIds: readonly string[];
  readonly sources: readonly string[];
}>;

function readDbRunId(run: ImplementationRuntimeRunView | null | undefined): string | null {
  const id = String(run?.id ?? "").trim();
  return id || null;
}

/** CodeTask별 canonical runId (JSON Run SoT, DB id 우선 정렬). */
export function resolveCanonicalCodeTaskRunId(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly processTaskId?: string | null;
  readonly existingRuns: readonly CodeTaskExecutionRunV1[];
  readonly existingRuntimeRuns?: readonly ImplementationRuntimeRunView[];
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
}): string {
  void input.projectId;
  void input.processTaskId;
  const codeTaskId = input.codeTaskId.trim();
  const jsonRun = findLatestRunForCodeTask(input.existingRuns, codeTaskId);
  if (jsonRun?.runId.trim()) {
    return jsonRun.runId.trim();
  }

  const dbRuns = input.existingRuntimeRuns ?? [];
  const dbForTask = dbRuns.filter((r) => r.codeTaskId === codeTaskId);
  const dbQueued = dbForTask.find((r) => r.runtimeState === "queued");
  const dbLatest = dbQueued ?? dbForTask[dbForTask.length - 1];
  const dbId = readDbRunId(dbLatest);
  if (dbId) return dbId;

  const cursor = input.taskCursorExecution;
  if (
    cursor &&
    cursor.taskId === input.processTaskId?.trim() &&
    jsonRun &&
    String(cursor.cursorRunId ?? "").trim() === jsonRun.runId
  ) {
    return jsonRun.runId;
  }

  return randomUuid();
}

export function detectCodeTaskRunIdentitySplit(input: {
  readonly codeTaskId: string;
  readonly canonicalRunId: string;
  readonly existingRuns: readonly CodeTaskExecutionRunV1[];
  readonly existingRuntimeRuns?: readonly ImplementationRuntimeRunView[];
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGateRunId?: string | null;
}): CodeTaskRunIdentitySplit | null {
  const observed = new Map<string, string>();
  const add = (runId: string | null | undefined, source: string) => {
    const id = String(runId ?? "").trim();
    if (!id) return;
    if (!observed.has(id)) observed.set(id, source);
  };

  for (const run of input.existingRuns.filter((r) => r.codeTaskId === input.codeTaskId)) {
    add(run.runId, "codeTaskExecutionRun");
  }
  for (const run of input.existingRuntimeRuns ?? []) {
    if (run.codeTaskId !== input.codeTaskId) continue;
    add(run.id, "dbRuntimeRun");
  }
  add(input.taskCursorExecution?.cursorRunId, "taskCursorExecution");
  add(input.autoGateRunId, "autoGate");

  const canonical = input.canonicalRunId.trim();
  const ids = [...observed.keys()];
  if (ids.length <= 1) return null;
  if (ids.length === 2 && ids.includes(canonical)) {
    const other = ids.find((id) => id !== canonical);
    if (other && observed.get(other) === "taskCursorExecution") return null;
  }
  if (ids.every((id) => id === canonical)) return null;

  return {
    codeTaskId: input.codeTaskId,
    canonicalRunId: canonical,
    observedRunIds: ids,
    sources: ids.map((id) => observed.get(id) ?? "unknown"),
  };
}
