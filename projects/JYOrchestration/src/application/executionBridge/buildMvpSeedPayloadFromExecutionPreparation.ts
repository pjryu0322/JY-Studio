/**
 * Maps a validated execution preparation bundle to the MVP bridge seed payload.
 * Pure: no store I/O.
 */

import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";
import type { Task } from "../../mvp/task/taskService";
import type { MvpBridgeSeedPayload } from "./mvpBridgeBootstrapContracts";
import { createBridgeSyntheticRootMenuSpec } from "./mvpBridgeBootstrapContracts";

export function buildMvpSeedPayloadFromExecutionPreparation(
  bundle: ExecutionPreparationBundle
): MvpBridgeSeedPayload {
  const syntheticRootMenu = createBridgeSyntheticRootMenuSpec(bundle.projectId);
  const menuId = syntheticRootMenu.id;

  const screens = bundle.screens.map((s, i) => ({
    id: s.id,
    projectId: bundle.projectId,
    name: s.name,
    menuId,
    routePath: s.routePath,
    order: i,
  }));

  /** Dense indices so {@link evaluateExecutionReadiness} uniqueness rules pass. */
  const tasks: Task[] = bundle.tasks.map((t, idx) => ({
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

  return {
    projectId: bundle.projectId,
    syntheticRootMenu,
    screens,
    tasks,
  };
}
