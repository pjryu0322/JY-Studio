/**
 * MVP — flow-aware task ordering (preparation only).
 */

import type { Task } from "../task/taskService";
import type { MvpScreen } from "../domain/mvpDomainTypes";
import type { ScreenFlowEdge } from "./mvpScreenFlowTypes";
import { getOrderedScreensFromFlow } from "./mvpScreenFlowService";

/**
 * Orders tasks using the resolved screen flow order from (screens, edges), then task order if present,
 * then `finalOrder`, then stable insertion order.
 *
 * Legacy tasks (no `screenId`) are kept supported and placed after flow-based tasks.
 */
export function orderTasksByScreenFlow(
  tasks: readonly Task[],
  screens: readonly MvpScreen[],
  edges: readonly ScreenFlowEdge[]
): Task[] {
  const orderedScreens = getOrderedScreensFromFlow({ screens: [...screens].map((s) => ({ ...s })), edges: [...edges].map((e) => ({ ...e })) });
  const rank = new Map<string, number>();
  for (let i = 0; i < orderedScreens.length; i += 1) {
    rank.set(orderedScreens[i]!.id, i);
  }

  return tasks
    .map((t, idx) => {
      const screenId = (t as { screenId?: string }).screenId;
      const screenRank = screenId && rank.has(screenId) ? (rank.get(screenId) as number) : Number.POSITIVE_INFINITY;
      const taskOrder = (t as { order?: number }).order;
      return {
        t,
        idx,
        screenRank,
        taskOrder: typeof taskOrder === "number" ? taskOrder : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => {
      if (a.screenRank !== b.screenRank) return a.screenRank - b.screenRank;
      if (a.taskOrder !== b.taskOrder) return a.taskOrder - b.taskOrder;
      if (a.t.finalOrder !== b.t.finalOrder) return a.t.finalOrder - b.t.finalOrder;
      return a.idx - b.idx;
    })
    .map((x) => ({ ...x.t }));
}

