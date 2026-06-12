import {
  augmentProductionCodeTaskIdRemap,
  remapCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskCanonicalId";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import {
  buildCodeTaskIdRemapFromPlanTasks,
  reconcileCursorWorkItemsWithCodeTaskIdRemap,
} from "@/lib/prototype/implementationCursorWorkItems";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export type AlignProductionCodeTaskIdsResultV1 = Readonly<{
  readonly requirementsState: RequirementsStateJson;
  readonly codeTaskPlan: ReturnType<typeof parseImplementationCodeTaskPlanV1>;
  readonly runs: ReturnType<typeof parseCodeTaskExecutionRunsV1>;
  readonly cursorWorkItems: RequirementsStateJson["cursorWorkItemsV1"];
  readonly planRepaired: boolean;
  readonly runsRepaired: boolean;
  readonly workItemsRepaired: boolean;
}>;

/** plan·run·workItem의 CodeTask id를 production SoT(정규 id)에 맞춘다 — UI/API/통합 공통. */
export function alignProductionCodeTaskIdsInRequirementsState(input: {
  readonly requirementsState: RequirementsStateJson;
  readonly taskList?: ImplementationTaskListV1 | null;
}): AlignProductionCodeTaskIdsResultV1 {
  const rawPlan = parseImplementationCodeTaskPlanV1(input.requirementsState.implementationCodeTaskPlanV1);
  const rawTasks = rawPlan?.tasks ?? [];
  const repairedPlan =
    ensureCodeTaskPlanWithFileBoundaries({ plan: rawPlan, taskList: input.taskList ?? null }) ??
    rawPlan;
  const repairedTasks = repairedPlan?.tasks ?? rawTasks;

  const idRemap = new Map(buildCodeTaskIdRemapFromPlanTasks(rawTasks, repairedTasks));
  const rawRuns = parseCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1) ?? [];
  augmentProductionCodeTaskIdRemap({
    remap: idRemap,
    repairedTasks,
    runCodeTaskIds: rawRuns.map((r) => r.codeTaskId),
  });

  const remappedRuns = remapCodeTaskExecutionRunsV1(rawRuns, idRemap);
  const reconciledWorkItems = reconcileCursorWorkItemsWithCodeTaskIdRemap({
    workItems: input.requirementsState.cursorWorkItemsV1 ?? [],
    idRemap,
  });

  let state = input.requirementsState;
  const planRepaired = Boolean(repairedPlan && repairedPlan !== rawPlan);
  if (planRepaired && repairedPlan) {
    state = { ...state, implementationCodeTaskPlanV1: repairedPlan };
  }
  const runsRepaired = remappedRuns !== rawRuns;
  if (runsRepaired) {
    state = { ...state, codeTaskExecutionRunsV1: remappedRuns };
  }
  const workItemsRepaired = reconciledWorkItems !== (input.requirementsState.cursorWorkItemsV1 ?? []);
  if (workItemsRepaired) {
    state = { ...state, cursorWorkItemsV1: [...reconciledWorkItems] };
  }

  return {
    requirementsState: state,
    codeTaskPlan: repairedPlan,
    runs: remappedRuns,
    cursorWorkItems: state.cursorWorkItemsV1,
    planRepaired,
    runsRepaired,
    workItemsRepaired,
  };
}
