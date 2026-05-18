/**
 * Post-seed verification: compares MVP stores to an expected {@link MvpBridgeSeedPayload}.
 * Structured result only (no HTTP).
 */

import { mvpListProjectMenuNodes } from "../../mvp/domain/stores/mvpMenuStore";
import { mvpListProjectScreens } from "../../mvp/domain/stores/mvpScreenStore";
import { listAllTasks } from "../../mvp/task/taskService";
import type { MvpBridgeSeedPayload } from "./mvpBridgeBootstrapContracts";
import { MVP_SEED_VERIFICATION_ISSUE_CODES, mvpSeedVerificationIssue } from "./mvpSeedVerificationIssueModel";
import type { MvpSeedVerificationIssue } from "./mvpSeedVerificationIssueModel";

export type { MvpSeedVerificationIssue, MvpSeedVerificationIssueCode } from "./mvpSeedVerificationIssueModel";

export type MvpSeedVerificationChecked = {
  readonly menuCount: number;
  readonly screenCount: number;
  readonly taskCount: number;
  readonly taskIdsInFinalOrder: readonly string[];
};

export type MvpSeedVerificationResult =
  | { readonly ok: true; readonly checked: MvpSeedVerificationChecked }
  | { readonly ok: false; readonly issues: readonly MvpSeedVerificationIssue[] };

export async function verifyMvpSeedPayloadApplied(payload: MvpBridgeSeedPayload): Promise<MvpSeedVerificationResult> {
  const issues: MvpSeedVerificationIssue[] = [];
  const projectId = payload.projectId;

  const menus = mvpListProjectMenuNodes(projectId);
  if (menus.length !== 1) {
    issues.push(
      mvpSeedVerificationIssue(
        MVP_SEED_VERIFICATION_ISSUE_CODES.MENU_COUNT_MISMATCH,
        `expected 1, got ${menus.length}`
      )
    );
  }
  const menu = menus[0];
  if (menu) {
    if (menu.id !== payload.syntheticRootMenu.id) {
      issues.push(
        mvpSeedVerificationIssue(
          MVP_SEED_VERIFICATION_ISSUE_CODES.SYNTHETIC_MENU_ID_MISMATCH,
          `expected ${payload.syntheticRootMenu.id}, got ${menu.id}`
        )
      );
    }
    if (menu.projectId !== projectId) {
      issues.push(
        mvpSeedVerificationIssue(MVP_SEED_VERIFICATION_ISSUE_CODES.MENU_PROJECT_ID_MISMATCH, "menu projectId mismatch")
      );
    }
  }

  const screens = mvpListProjectScreens(projectId);
  if (screens.length !== payload.screens.length) {
    issues.push(
      mvpSeedVerificationIssue(
        MVP_SEED_VERIFICATION_ISSUE_CODES.SCREEN_COUNT_MISMATCH,
        `expected ${payload.screens.length}, got ${screens.length}`
      )
    );
  }

  const screenIds = new Set(payload.screens.map((s) => s.id));
  for (let i = 0; i < screens.length; i++) {
    const s = screens[i]!;
    const expected = payload.screens[i];
    if (expected && s.id !== expected.id) {
      issues.push(
        mvpSeedVerificationIssue(
          MVP_SEED_VERIFICATION_ISSUE_CODES.SCREEN_ORDER_ID_MISMATCH,
          `index ${i}: expected id ${expected.id}, got ${s.id}`
        )
      );
    }
    if (s.projectId !== projectId) {
      issues.push(
        mvpSeedVerificationIssue(MVP_SEED_VERIFICATION_ISSUE_CODES.SCREEN_PROJECT_ID_MISMATCH, `screen ${s.id}`)
      );
    }
    if (s.menuId !== payload.syntheticRootMenu.id) {
      issues.push(
        mvpSeedVerificationIssue(
          MVP_SEED_VERIFICATION_ISSUE_CODES.SCREEN_MENU_REF_MISMATCH,
          `screen ${s.id} menuId ${s.menuId}`
        )
      );
    }
    if (!screenIds.has(s.id)) {
      issues.push(mvpSeedVerificationIssue(MVP_SEED_VERIFICATION_ISSUE_CODES.SCREEN_UNEXPECTED, s.id));
    }
  }
  for (const sid of screenIds) {
    if (!screens.some((s) => s.id === sid)) {
      issues.push(mvpSeedVerificationIssue(MVP_SEED_VERIFICATION_ISSUE_CODES.SCREEN_MISSING, sid));
    }
  }

  const tasks = await listAllTasks(projectId);
  if (tasks.length !== payload.tasks.length) {
    issues.push(
      mvpSeedVerificationIssue(
        MVP_SEED_VERIFICATION_ISSUE_CODES.TASK_COUNT_MISMATCH,
        `expected ${payload.tasks.length}, got ${tasks.length}`
      )
    );
  }

  const expectedTaskIds = payload.tasks.map((t) => t.id);
  const expectedIdSet = new Set(expectedTaskIds);
  const sortedByOrder = [...tasks].sort((a, b) => a.finalOrder - b.finalOrder);
  const observedIds = sortedByOrder.map((t) => t.id);

  for (const t of tasks) {
    if (t.projectId !== projectId) {
      issues.push(mvpSeedVerificationIssue(MVP_SEED_VERIFICATION_ISSUE_CODES.TASK_PROJECT_ID_MISMATCH, t.id));
    }
    if (t.screenId != null && !screenIds.has(t.screenId)) {
      issues.push(
        mvpSeedVerificationIssue(MVP_SEED_VERIFICATION_ISSUE_CODES.TASK_SCREEN_REF_INVALID, `${t.id} -> ${t.screenId}`)
      );
    }
  }

  for (let i = 0; i < expectedTaskIds.length; i++) {
    if (observedIds[i] !== expectedTaskIds[i]) {
      issues.push(
        mvpSeedVerificationIssue(
          MVP_SEED_VERIFICATION_ISSUE_CODES.TASK_ORDER_MISMATCH,
          `position ${i}: expected ${expectedTaskIds[i]}, got ${observedIds[i] ?? "(missing)"}`
        )
      );
      break;
    }
  }

  for (const t of tasks) {
    if (!expectedIdSet.has(t.id)) {
      issues.push(mvpSeedVerificationIssue(MVP_SEED_VERIFICATION_ISSUE_CODES.TASK_UNEXPECTED, t.id));
    }
  }
  for (const id of expectedTaskIds) {
    if (!tasks.some((t) => t.id === id)) {
      issues.push(mvpSeedVerificationIssue(MVP_SEED_VERIFICATION_ISSUE_CODES.TASK_MISSING, id));
    }
  }

  const orders = sortedByOrder.map((t) => t.finalOrder);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i) {
      issues.push(
        mvpSeedVerificationIssue(
          MVP_SEED_VERIFICATION_ISSUE_CODES.TASK_FINAL_ORDER_NOT_DENSE,
          `index ${i} finalOrder ${orders[i]}`
        )
      );
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
