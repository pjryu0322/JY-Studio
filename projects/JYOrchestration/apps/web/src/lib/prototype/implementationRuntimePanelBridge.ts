import {
  buildRuntimeStateWithActiveDispatch,
  parseImplementationRuntimeStateV1,
  type ImplementationRuntimeActiveDispatchV1,
  type ImplementationRuntimeStateV1,
} from "@/lib/prototype/implementationRuntimeState";
import type { CodeTaskQueueDispatchRef } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export function resolvePersistedQueueDispatch(
  state: Pick<RequirementsStateJson, "implementationRuntimeStateV1">,
): CodeTaskQueueDispatchRef | null {
  const dispatch = parseImplementationRuntimeStateV1(state.implementationRuntimeStateV1)?.activeDispatch;
  if (!dispatch) return null;
  return {
    codeTaskId: dispatch.codeTaskId,
    parentTaskId: dispatch.parentTaskId,
    workItemId: dispatch.workItemId,
  };
}

export function buildPersistedActiveDispatchPatch(input: {
  readonly projectId: string;
  readonly dispatch: ImplementationRuntimeActiveDispatchV1;
  readonly baseState: Record<string, unknown>;
  readonly nowIso?: string;
}): ImplementationRuntimeStateV1 {
  return buildRuntimeStateWithActiveDispatch({
    projectId: input.projectId,
    dispatch: input.dispatch,
    baseState: input.baseState,
    nowIso: input.nowIso,
  });
}
