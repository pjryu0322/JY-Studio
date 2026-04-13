/**
 * Wraps task synthesis with internal empty / invalid semantics (no HTTP).
 */

import type { ScreenGenerationResult } from "../screenGeneration/screenGenerationContracts";
import { generateTasksFromScreens, type ScreenInputForTasks } from "./generateTasksFromScreens";
import type { StandardTaskGenerationOutput, TaskGenerationResult } from "./taskGenerationContracts";

function validateScreens(screens: readonly ScreenInputForTasks[]): string | null {
  if (screens.length === 0) return "EMPTY";
  const pids = new Set(screens.map((s) => s.projectId));
  if (pids.size !== 1) return "MULTI_PROJECT";
  return null;
}

export function buildTaskGenerationResult(screenResult: ScreenGenerationResult): StandardTaskGenerationOutput {
  const { projectId, screens } = screenResult;
  const list = screens as ScreenInputForTasks[];
  const err = validateScreens(list);
  if (err === "EMPTY") {
    return { state: "EMPTY_SCREEN", result: { projectId, tasks: [], traces: [] } };
  }
  if (err != null) {
    return { state: "INVALID_SCREEN_INPUT", result: null };
  }
  if (screens.some((s) => s.projectId !== projectId)) {
    return { state: "INVALID_SCREEN_INPUT", result: null };
  }
  const result: TaskGenerationResult = generateTasksFromScreens(list);
  return { state: "GENERATED", result };
}
