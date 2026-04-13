/**
 * Adapts a validated {@link import("../planningExecutionHandoff/planningExecutionHandoffTypes").PlanningExecutionHandoffBundle}
 * into a minimal {@link import("./executionPreparationContracts").ExecutionPreparationBundle}.
 *
 * Does not call `executionService`, `promptService`, or run/retry/review.
 */

import type { PlanningExecutionHandoffBundle } from "../planningExecutionHandoff/planningExecutionHandoffTypes";
import type {
  BuildExecutionPreparationBundleResult,
  ExecutionPreparationBundle,
  ExecutionPreparationContext,
  ExecutionPreparationScreenRef,
  ExecutionPreparationTask,
} from "./executionPreparationContracts";

function mapScreens(handoff: PlanningExecutionHandoffBundle): readonly ExecutionPreparationScreenRef[] {
  return [...handoff.screens.screens]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      routePath: s.routePath,
      screenRole: String(s.screenRole),
    }));
}

function mapTasksInHandoffOrder(handoff: PlanningExecutionHandoffBundle): readonly ExecutionPreparationTask[] {
  return handoff.tasks.tasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    name: t.name,
    screenId: t.screenId,
    order: t.order,
    taskPurpose: t.taskPurpose,
  }));
}

export function buildExecutionPreparationBundle(handoff: PlanningExecutionHandoffBundle): BuildExecutionPreparationBundleResult {
  if (handoff.pipelineStatus !== "READY") {
    return { ok: false, reason: "EXEC_PREP_HANDOFF_NOT_READY" };
  }

  const screens = mapScreens(handoff);
  const tasks = mapTasksInHandoffOrder(handoff);

  if (tasks.length === 0) {
    return { ok: false, reason: "EXEC_PREP_EMPTY_TASKS" };
  }
  if (screens.length === 0) {
    return { ok: false, reason: "EXEC_PREP_EMPTY_SCREENS" };
  }

  const context: ExecutionPreparationContext = {
    projectId: handoff.projectId,
    taskCount: tasks.length,
    screenCount: screens.length,
    featureCount: handoff.features.features.length,
  };

  const bundle: ExecutionPreparationBundle = {
    projectId: handoff.projectId,
    context,
    screens,
    tasks,
    source: "PLANNING_HANDOFF",
  };

  return { ok: true, bundle };
}
