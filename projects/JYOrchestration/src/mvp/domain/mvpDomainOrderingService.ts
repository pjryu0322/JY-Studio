/**
 * MVP — ordering helpers for domain-driven task flows (preparation only).
 * Not wired into executionService; callers may choose to order tasks before seeding.
 */

import type { Task } from "../task/taskService";
import { mvpGetScreenById } from "./stores/mvpScreenStore";

/**
 * Sorts tasks by Screen.order (when `screenId` exists), then by Task.finalOrder.
 * Legacy tasks (no `screenId`) are ordered after screen-aware tasks by default.
 */
export function orderTasksByScreenFlow(tasks: readonly Task[]): Task[] {
  const withKeys = tasks.map((t, idx) => {
    const screenId = (t as { screenId?: string }).screenId;
    const screen = screenId ? mvpGetScreenById(screenId) : undefined;
    const screenOrder = screen ? screen.order : Number.POSITIVE_INFINITY;
    return {
      t,
      idx,
      screenOrder,
      taskOrder: t.finalOrder,
    };
  });

  return withKeys
    .sort((a, b) => {
      if (a.screenOrder !== b.screenOrder) return a.screenOrder - b.screenOrder;
      if (a.taskOrder !== b.taskOrder) return a.taskOrder - b.taskOrder;
      return a.idx - b.idx;
    })
    .map((x) => ({ ...x.t }));
}

