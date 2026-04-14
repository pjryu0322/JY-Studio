/**
 * Post-seed verification: compares MVP stores to an expected {@link MvpBridgeSeedPayload}.
 * Structured result only (no HTTP).
 */

import { mvpListProjectMenuNodes } from "../../mvp/domain/stores/mvpMenuStore";
import { mvpListProjectScreens } from "../../mvp/domain/stores/mvpScreenStore";
import { listAllTasks } from "../../mvp/task/taskService";
import type { MvpBridgeSeedPayload } from "./mvpBridgeBootstrapContracts";

export type MvpSeedVerificationIssue = {
  readonly code: string;
  readonly detail?: string;
};

export type MvpSeedVerificationChecked = {
  readonly menuCount: number;
  readonly screenCount: number;
  readonly taskCount: number;
  readonly taskIdsInFinalOrder: readonly string[];
};

export type MvpSeedVerificationResult =
  | { readonly ok: true; readonly checked: MvpSeedVerificationChecked }
  | { readonly ok: false; readonly issues: readonly MvpSeedVerificationIssue[] };

function issue(code: string, detail?: string): MvpSeedVerificationIssue {
  return detail !== undefined ? { code, detail } : { code };
}

export async function verifyMvpSeedPayloadApplied(payload: MvpBridgeSeedPayload): Promise<MvpSeedVerificationResult> {
  const issues: MvpSeedVerificationIssue[] = [];
  const projectId = payload.projectId;

  const menus = mvpListProjectMenuNodes(projectId);
  if (menus.length !== 1) {
    issues.push(issue("MENU_COUNT", `expected 1, got ${menus.length}`));
  }
  const menu = menus[0];
  if (menu) {
    if (menu.id !== payload.syntheticRootMenu.id) {
      issues.push(issue("SYNTHETIC_MENU_ID", `expected ${payload.syntheticRootMenu.id}, got ${menu.id}`));
    }
    if (menu.projectId !== projectId) {
      issues.push(issue("MENU_PROJECT_ID", "menu projectId mismatch"));
    }
  }

  const screens = mvpListProjectScreens(projectId);
  if (screens.length !== payload.screens.length) {
    issues.push(issue("SCREEN_COUNT", `expected ${payload.screens.length}, got ${screens.length}`));
  }

  const screenIds = new Set(payload.screens.map((s) => s.id));
  for (let i = 0; i < screens.length; i++) {
    const s = screens[i]!;
    const expected = payload.screens[i];
    if (expected && s.id !== expected.id) {
      issues.push(issue("SCREEN_ORDER_ID", `index ${i}: expected id ${expected.id}, got ${s.id}`));
    }
    if (s.projectId !== projectId) {
      issues.push(issue("SCREEN_PROJECT_ID", `screen ${s.id}`));
    }
    if (s.menuId !== payload.syntheticRootMenu.id) {
      issues.push(issue("SCREEN_MENU_REF", `screen ${s.id} menuId ${s.menuId}`));
    }
    if (!screenIds.has(s.id)) {
      issues.push(issue("SCREEN_UNEXPECTED", s.id));
    }
  }
  for (const sid of screenIds) {
    if (!screens.some((s) => s.id === sid)) {
      issues.push(issue("SCREEN_MISSING", sid));
    }
  }

  const tasks = await listAllTasks(projectId);
  if (tasks.length !== payload.tasks.length) {
    issues.push(issue("TASK_COUNT", `expected ${payload.tasks.length}, got ${tasks.length}`));
  }

  const expectedTaskIds = payload.tasks.map((t) => t.id);
  const expectedIdSet = new Set(expectedTaskIds);
  const sortedByOrder = [...tasks].sort((a, b) => a.finalOrder - b.finalOrder);
  const observedIds = sortedByOrder.map((t) => t.id);

  for (const t of tasks) {
    if (t.projectId !== projectId) {
      issues.push(issue("TASK_PROJECT_ID", t.id));
    }
    if (t.screenId != null && !screenIds.has(t.screenId)) {
      issues.push(issue("TASK_SCREEN_REF", `${t.id} -> ${t.screenId}`));
    }
  }

  for (let i = 0; i < expectedTaskIds.length; i++) {
    if (observedIds[i] !== expectedTaskIds[i]) {
      issues.push(
        issue(
          "TASK_ORDER",
          `position ${i}: expected ${expectedTaskIds[i]}, got ${observedIds[i] ?? "(missing)"}`
        )
      );
      break;
    }
  }

  for (const t of tasks) {
    if (!expectedIdSet.has(t.id)) {
      issues.push(issue("TASK_UNEXPECTED", t.id));
    }
  }
  for (const id of expectedTaskIds) {
    if (!tasks.some((t) => t.id === id)) {
      issues.push(issue("TASK_MISSING", id));
    }
  }

  const orders = sortedByOrder.map((t) => t.finalOrder);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i) {
      issues.push(issue("TASK_FINAL_ORDER_DENSE", `index ${i} finalOrder ${orders[i]}`));
      break;
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    checked: {
      menuCount: menus.length,
      screenCount: screens.length,
      taskCount: tasks.length,
      taskIdsInFinalOrder: observedIds,
    },
  };
}
