import {
  buildRuntimeStateWithActiveDispatch,
  type ImplementationRuntimeActiveDispatchV1,
} from "@/lib/prototype/implementationRuntimeState";
import type { CodeTaskQueueDispatchRef } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { readActiveRuntimeDispatchFromState } from "@/lib/prototype/implementationRuntimeSync";
import {
  buildImplementationRuntimeUiSnapshotFromRuntimeState,
  type ImplementationRuntimeUiSnapshotV1,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";

export function resolvePersistedQueueDispatch(
  state: Pick<
    RequirementsStateJson,
    "implementationRuntimeStateV1" | "implementationRuntimeUiSnapshotV1"
  >,
): CodeTaskQueueDispatchRef | null {
  const dispatch = readActiveRuntimeDispatchFromState(state as Record<string, unknown>);
  if (!dispatch) return null;
  return {
    codeTaskId: dispatch.codeTaskId,
    parentTaskId: dispatch.parentTaskId,
    workItemId: dispatch.workItemId,
  };
}

/** activeDispatch를 UI snapshot에만 기록 */
export function buildPersistedActiveDispatchSnapshotPatch(input: {
  readonly projectId: string;
  readonly dispatch: ImplementationRuntimeActiveDispatchV1;
  readonly baseState: Record<string, unknown>;
  readonly nowIso?: string;
}): ImplementationRuntimeUiSnapshotV1 {
  const runtime = buildRuntimeStateWithActiveDispatch({
    projectId: input.projectId,
    dispatch: input.dispatch,
    baseState: input.baseState,
    nowIso: input.nowIso,
  });
  return buildImplementationRuntimeUiSnapshotFromRuntimeState({
    runtime,
    activeDispatch: input.dispatch,
  });
}
