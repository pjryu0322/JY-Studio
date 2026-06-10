import type { CodeTaskSelectionModeV1 } from "@/lib/prototype/implementationCodeTaskSelectionPolicy";
import { DEFAULT_CODE_TASK_TREE_SELECTION_MODE } from "@/lib/prototype/implementationCodeTaskSelectionPolicy";

export type ImplementationBoardSelectedActionKindV1 =
  | "execute_selected"
  | "rework_selected"
  | "prepare_integration_preview"
  | null;

export function resolveCodeTaskSelectionMode(input: {
  readonly selectedActionKind?: ImplementationBoardSelectedActionKindV1;
  readonly focusedTaskStatus?: string | null;
  readonly hasRunnableTasks?: boolean;
  readonly hasCompletedTasks?: boolean;
  readonly surface?: "task_tree" | "integration_section" | null;
}): CodeTaskSelectionModeV1 {
  if (input.surface === "integration_section") return "integration";
  if (input.selectedActionKind === "prepare_integration_preview") return "integration";
  if (input.selectedActionKind === "rework_selected") return "rework";
  return DEFAULT_CODE_TASK_TREE_SELECTION_MODE;
}
