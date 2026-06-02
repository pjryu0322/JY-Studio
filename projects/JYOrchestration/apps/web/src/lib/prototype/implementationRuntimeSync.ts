import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  deriveImplementationRuntimeFromRequirementsState,
  parseImplementationRuntimeStateV1,
  type ImplementationRuntimeActiveDispatchV1,
  type ImplementationRuntimeStateV1,
} from "@/lib/prototype/implementationRuntimeState";
import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

/** orchestration patch에 implementationRuntimeStateV1을 동기화한다. */
export function withImplementationRuntimeOrchestrationPatch(input: {
  readonly projectId: string;
  readonly patch: PrototypeExecutionOrchestrationPersistInput;
  readonly baseRequirementsState?: Record<string, unknown>;
  readonly nowIso?: string;
}): PrototypeExecutionOrchestrationPersistInput {
  const base = { ...(input.baseRequirementsState ?? {}), ...input.patch } as Record<string, unknown>;
  const runtime = deriveImplementationRuntimeFromRequirementsState({
    raw: base,
    projectId: input.projectId,
    nowIso: input.nowIso,
  });
  return {
    ...input.patch,
    implementationRuntimeStateV1: runtime,
  };
}

export function readActiveRuntimeDispatchFromState(raw: Record<string, unknown>): ImplementationRuntimeActiveDispatchV1 | null {
  const runtime = parseImplementationRuntimeStateV1(raw.implementationRuntimeStateV1);
  return runtime?.activeDispatch ?? null;
}

export function readImplementationRuntimeFromState(
  raw: Record<string, unknown>,
): ImplementationRuntimeStateV1 | null {
  return parseImplementationRuntimeStateV1(raw.implementationRuntimeStateV1);
}

export function mergeRequirementsStateWithRuntime(input: {
  readonly projectId: string;
  readonly state: Record<string, unknown>;
  readonly nowIso?: string;
}): Record<string, unknown> {
  const runtime = deriveImplementationRuntimeFromRequirementsState({
    raw: input.state,
    projectId: input.projectId,
    nowIso: input.nowIso,
  });
  return { ...input.state, implementationRuntimeStateV1: runtime };
}

export function snapshotRuntimeContext(raw: Record<string, unknown>) {
  return {
    queue: parseCodeTaskExecutionQueueV1(raw.codeTaskExecutionQueueV1),
    runs: parseCodeTaskExecutionRunsV1(raw.codeTaskExecutionRunsV1),
    taskCursor: parseTaskCursorExecutionV1(raw.taskCursorExecutionV1),
    runtime: parseImplementationRuntimeStateV1(raw.implementationRuntimeStateV1),
  };
}
