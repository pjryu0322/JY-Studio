/**
 * Planning-layer Task synthesis from screens (no HTTP / no execution).
 */

import type { ScreenGenerationResult } from "../screenGeneration/screenGenerationContracts";

export type TaskGenerationRule = "ONE_TASK_PER_SCREEN" | "MOCKUP_PURPOSE";

export type TaskDraft = {
  id: string;
  projectId: string;
  /** Action-oriented title (maps to MVP {@link Task} `title`). */
  name: string;
  screenId: string;
  /** Dense rank for ordering (maps to MVP `finalOrder`). */
  order: number;
  taskPurpose: "MOCKUP";
  /** Planning-only; {@link taskDraftsToMvpTasks} maps to `CONFIRMED` for execution. */
  status: "READY";
};

export type TaskTrace = {
  taskId: string;
  screenId: string;
};

export type TaskGenerationResult = {
  projectId: string;
  tasks: TaskDraft[];
  traces: TaskTrace[];
};

export type StandardTaskGenerationState = "GENERATED" | "EMPTY_SCREEN" | "INVALID_SCREEN_INPUT";

export type StandardTaskGenerationOutput = {
  state: StandardTaskGenerationState;
  result: TaskGenerationResult | null;
};

export type GenerateStandardTasksRequest = {
  screenResult: ScreenGenerationResult;
};
