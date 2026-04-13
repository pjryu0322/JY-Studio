/**
 * MVP — helper lookups between Task and Screen.
 *
 * Legacy tasks without `screenId` are supported (returns null).
 */

import { mvpGetTaskById } from "../task/taskService";
import type { MvpScreen } from "./mvpDomainTypes";
import { mvpGetScreenById } from "./stores/mvpScreenStore";

export function getScreenByTask(taskId: string): MvpScreen | null {
  const t = mvpGetTaskById(taskId);
  const screenId = (t as { screenId?: string } | undefined)?.screenId;
  if (!screenId) {
    return null;
  }
  return mvpGetScreenById(screenId) ?? null;
}

