/**
 * Maps {@link import("../executionPreparation/executionPreparationContracts").ExecutionPreparationBundle}
 * to {@link import("./executionBridgeContracts").ExecutionBridgeInput} (deterministic, execution-facing only).
 */

import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";
import type { ExecutionBridgeInput, ExecutionBridgePrepareResult, ExecutionBridgeTaskInput } from "./executionBridgeContracts";

function mapTasks(bundle: ExecutionPreparationBundle): readonly ExecutionBridgeTaskInput[] {
  return bundle.tasks.map((t) => ({
    taskId: t.id,
    projectId: t.projectId,
    name: t.name,
    screenId: t.screenId,
    order: t.order,
    taskPurpose: t.taskPurpose,
  }));
}

export function buildExecutionBridgeInput(bundle: ExecutionPreparationBundle): ExecutionBridgePrepareResult {
  if (bundle.source !== "PLANNING_HANDOFF") {
    return { ok: false, reason: "BRIDGE_PREP_SOURCE_NOT_PLANNING_HANDOFF" };
  }
  if (bundle.tasks.length === 0) {
    return { ok: false, reason: "BRIDGE_PREP_EMPTY_TASKS" };
  }

  const input: ExecutionBridgeInput = {
    projectId: bundle.projectId,
    source: "EXECUTION_PREPARATION",
    tasks: mapTasks(bundle),
    metadata: {
      taskCount: bundle.context.taskCount,
      screenCount: bundle.context.screenCount,
    },
  };

  return { ok: true, input };
}
