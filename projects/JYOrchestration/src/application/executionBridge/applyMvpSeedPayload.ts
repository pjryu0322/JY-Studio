/**
 * Applies a bridge MVP seed payload to in-memory MVP stores (menu, screen, task).
 * No verification; see {@link verifyMvpSeedPayloadApplied}.
 */

import type { MvpMenuNode } from "../../mvp/domain/mvpDomainTypes";
import { mvpSeedProjectMenuNodes } from "../../mvp/domain/stores/mvpMenuStore";
import { mvpSeedProjectScreens } from "../../mvp/domain/stores/mvpScreenStore";
import { mvpSeedProjectTasks } from "../../mvp/task/taskService";
import type { MvpBridgeSeedPayload } from "./mvpBridgeBootstrapContracts";

function syntheticSpecToMenuNode(spec: MvpBridgeSeedPayload["syntheticRootMenu"]): MvpMenuNode {
  return {
    id: spec.id,
    projectId: spec.projectId,
    name: spec.displayName,
    parentId: spec.parentId,
    order: spec.order,
  };
}

export function applyMvpSeedPayload(payload: MvpBridgeSeedPayload): void {
  mvpSeedProjectMenuNodes(payload.projectId, [syntheticSpecToMenuNode(payload.syntheticRootMenu)]);
  mvpSeedProjectScreens(payload.projectId, [...payload.screens]);
  mvpSeedProjectTasks(payload.projectId, [...payload.tasks]);
}
