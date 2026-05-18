/**
 * Self-check helpers: legacy-style MVP seeding from an {@link ExecutionPreparationBundle}
 * without calling {@link buildMvpSeedPayloadFromExecutionPreparation}.
 *
 * Intended to stay aligned with `buildMvpSeedPayloadFromExecutionPreparation` + {@link applyMvpSeedPayload};
 * parity tests pair this with `verifyMvpSeedPayloadApplied(expectedPayloadFromBuild)` to detect drift.
 */

import type { Task } from "../../mvp/task/taskService";
import { mvpSeedProjectMenuNodes } from "../../mvp/domain/stores/mvpMenuStore";
import { mvpSeedProjectScreens } from "../../mvp/domain/stores/mvpScreenStore";
import { mvpSeedProjectTasks } from "../../mvp/task/taskService";
import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";

/**
 * Applies the same menu/screen/task rows the bridge builder produces, via direct store calls only.
 * Does not run post-seed verification.
 */
export function applyLegacyMvpSeedFromExecutionPreparationBundle(bundle: ExecutionPreparationBundle): void {
  const menuId = `mvp-bridge-menu-root-${bundle.projectId}`;
  mvpSeedProjectMenuNodes(bundle.projectId, [
    { id: menuId, projectId: bundle.projectId, name: "Planning bridge", parentId: null, order: 0 },
  ]);

  mvpSeedProjectScreens(
    bundle.projectId,
    bundle.screens.map((s, i) => ({
      id: s.id,
      projectId: bundle.projectId,
      name: s.name,
      menuId,
      routePath: s.routePath,
      order: i,
    }))
  );

  const mvpTasks: Task[] = bundle.tasks.map((t, idx) => ({
    id: t.id,
    title: t.name,
    description: t.name,
    type: "FUNCTIONAL",
    status: "CONFIRMED",
    finalOrder: idx,
    projectId: bundle.projectId,
    screenId: t.screenId,
    taskPurpose: "MOCKUP",
  }));

  mvpSeedProjectTasks(bundle.projectId, mvpTasks);
}

/** Deterministic minimal bundle for parity tests (validates with execution prep + bridge validators). */
export function minimalExecutionPreparationBundleForParity(projectId: string): ExecutionPreparationBundle {
  const screenId = `parity-sc-1-${projectId}`;
  const taskId = `parity-tk-1-${projectId}`;
  return {
    projectId,
    source: "PLANNING_HANDOFF",
    context: {
      projectId,
      taskCount: 1,
      screenCount: 1,
      featureCount: 1,
    },
    screens: [
      {
        id: screenId,
        projectId,
        name: "Parity Screen",
        routePath: "/parity",
        screenRole: "MAIN",
      },
    ],
    tasks: [
      {
        id: taskId,
        projectId,
        name: "Parity Task",
        screenId,
        order: 0,
        taskPurpose: "MOCKUP",
      },
    ],
  };
}
