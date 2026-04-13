/**
 * Seeds MVP in-memory stores from a validated {@link import("../executionPreparation/executionPreparationContracts").ExecutionPreparationBundle}
 * so {@link mvpStartExecutionUseCase} readiness matches planning-derived tasks.
 *
 * Bridge-only: not used by legacy `mvpSeedProjectTasks` + `startRun` flows directly.
 */

import type { Task } from "../../mvp/task/taskService";
import { mvpSeedProjectTasks } from "../../mvp/task/taskService";
import { mvpSeedProjectMenuNodes } from "../../mvp/domain/stores/mvpMenuStore";
import { mvpSeedProjectScreens } from "../../mvp/domain/stores/mvpScreenStore";
import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";

export function applyExecutionPreparationToMvpStores(bundle: ExecutionPreparationBundle): void {
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

  /** `finalOrder` is dense 0..n-1 so {@link evaluateExecutionReadiness} uniqueness rules pass. */
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
