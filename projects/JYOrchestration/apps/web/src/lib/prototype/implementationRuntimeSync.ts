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
import {
  buildImplementationRuntimeUiSnapshotFromRuntimeState,
  stripLegacyImplementationRuntimeStateFromRecord,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";

function buildUiSnapshotForPersist(input: {
  readonly projectId: string;
  readonly state: Record<string, unknown>;
  readonly nowIso?: string;
  readonly activeDispatchOverride?: ImplementationRuntimeActiveDispatchV1 | null;
}): ReturnType<typeof buildImplementationRuntimeUiSnapshotFromRuntimeState> {
  const runtime = deriveImplementationRuntimeFromRequirementsState({
    raw: input.state,
    projectId: input.projectId,
    nowIso: input.nowIso,
  });
  const dispatch =
    input.activeDispatchOverride ??
    parseImplementationRuntimeStateV1(input.state.implementationRuntimeStateV1)?.activeDispatch ??
    runtime.activeDispatch ??
    null;
  return buildImplementationRuntimeUiSnapshotFromRuntimeState({
    runtime,
    activeDispatch: dispatch,
  });
}

/** orchestration patch — Runtime SoT는 DB, JSON에는 UI snapshot만 기록 */
export function withImplementationRuntimeOrchestrationPatch(input: {
  readonly projectId: string;
  readonly patch: PrototypeExecutionOrchestrationPersistInput;
  readonly baseRequirementsState?: Record<string, unknown>;
  readonly nowIso?: string;
}): PrototypeExecutionOrchestrationPersistInput {
  const base = stripLegacyImplementationRuntimeStateFromRecord({
    ...(input.baseRequirementsState ?? {}),
    ...input.patch,
  } as Record<string, unknown>);
  const snapshot = buildUiSnapshotForPersist({
    projectId: input.projectId,
    state: base,
    nowIso: input.nowIso,
  });
  const { implementationRuntimeStateV1: _legacy, ...patchRest } = input.patch as Record<string, unknown>;
  return {
    ...(patchRest as PrototypeExecutionOrchestrationPersistInput),
    implementationRuntimeUiSnapshotV1: snapshot,
  };
}

export function readActiveRuntimeDispatchFromState(
  raw: Record<string, unknown>,
): ImplementationRuntimeActiveDispatchV1 | null {
  const snapshot = raw.implementationRuntimeUiSnapshotV1;
  if (snapshot && typeof snapshot === "object") {
    const dispatch = (snapshot as { activeDispatch?: ImplementationRuntimeActiveDispatchV1 }).activeDispatch;
    if (dispatch?.codeTaskId) return dispatch;
  }
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
  const withoutLegacy = stripLegacyImplementationRuntimeStateFromRecord(input.state);
  const snapshot = buildUiSnapshotForPersist({
    projectId: input.projectId,
    state: withoutLegacy,
    nowIso: input.nowIso,
  });
  return {
    ...withoutLegacy,
    implementationRuntimeUiSnapshotV1: snapshot,
  };
}

export function snapshotRuntimeContext(raw: Record<string, unknown>) {
  return {
    queue: parseCodeTaskExecutionQueueV1(raw.codeTaskExecutionQueueV1),
    runs: parseCodeTaskExecutionRunsV1(raw.codeTaskExecutionRunsV1),
    taskCursor: parseTaskCursorExecutionV1(raw.taskCursorExecutionV1),
    uiSnapshot: raw.implementationRuntimeUiSnapshotV1,
    runtime: parseImplementationRuntimeStateV1(raw.implementationRuntimeStateV1),
  };
}
