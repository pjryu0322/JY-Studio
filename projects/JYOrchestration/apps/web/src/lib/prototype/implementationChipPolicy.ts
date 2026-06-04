import {
  boardShowsRequestTaskReworkChip,
  deriveIntegratedStageInterviewChips,
  type ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import { deriveCodeAgentWipBoardInterviewChips } from "@/lib/prototype/codeAgentWipExecution";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import { deriveImplementationUserTestReadiness } from "@/lib/prototype/implementationUserTestReadiness";
import {
  AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
  DESIGNER_REVIEW_CHIP,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_EXECUTION_BOARD_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP,
  MOVE_TO_REVIEW_STAGE_CHIP,
  REQUEST_TASK_REWORK_CHIP,
  REVIEWER_CHECK_CHIP,
  SECURITY_CHECK_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";

export type ImplementationChipMessageContext =
  | "execution_board"
  | "task_list_detail"
  | "quality_result"
  | "security_result"
  | "rework_notice"
  | "generic";

export function dedupeImplementationChips<T extends string>(chips: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const chip of chips) {
    const key = chip.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
  }
  return out;
}

export function filterImplementationChipsForMessageContext(input: {
  readonly chips: readonly string[];
  readonly context: ImplementationChipMessageContext;
}): readonly string[] {
  const deduped = dedupeImplementationChips(input.chips);
  const hide = new Set<string>();
  if (input.context === "execution_board") {
    hide.add(TASK_LIST_VIEW_CHIP);
    hide.add(IMPLEMENTATION_EXECUTION_BOARD_CHIP);
  }
  if (input.context === "task_list_detail") {
    hide.add(TASK_LIST_VIEW_CHIP);
  }
  return deduped.filter((chip) => !hide.has(chip));
}

function orderEnvFirst(chips: readonly string[], envOk: boolean): readonly string[] {
  if (envOk !== false) return chips;
  const withoutEnv = chips.filter((c) => c !== IMPLEMENTATION_ENV_SETTINGS_LABEL);
  return [IMPLEMENTATION_ENV_SETTINGS_LABEL, ...withoutEnv];
}

/** Interview chips for execution board messages (no self-referential board/task-list CTAs). */
export function deriveImplementationBoardInterviewChips(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly envOk?: boolean;
  readonly previewReady?: boolean;
  readonly hasExecutionState?: boolean;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
}): readonly string[] {
  const wipChips = input.codeAgentWipExecutionV1
    ? deriveCodeAgentWipBoardInterviewChips(input.codeAgentWipExecutionV1)
    : null;
  if (wipChips?.length) {
    return orderEnvFirst(
      filterImplementationChipsForMessageContext({ chips: [...wipChips], context: "execution_board" }),
      input.envOk !== false,
    );
  }

  const board = input.board;
  const developerDoneCount = board.taskRows.filter(
    (row) => row.developerStatus === "done" || row.developerStatus === "skipped",
  ).length;
  const reviewerDoneCount = board.taskRows.filter((row) => row.reviewerStatus === "done").length;
  const developerInProgress = board.taskRows.some((row) => row.developerStatus === "in_progress");
  const showReworkChip = boardShowsRequestTaskReworkChip(board);
  const hasFailed = board.summary.failedTasks > 0;
  const allTasksComplete =
    board.taskRows.length > 0 && board.taskRows.every((row) => row.currentRole === "completed");

  const chips: string[] = [IMPLEMENTATION_GENERATION_REQUEST_CHIP, IMPLEMENTATION_ENV_SETTINGS_LABEL];

  if (hasFailed || showReworkChip) {
    chips.push(AI_DEVELOPER_REMEDIATION_REQUEST_CHIP);
    if (showReworkChip) chips.push(REQUEST_TASK_REWORK_CHIP);
    if (board.summary.userConfirmationRequired > 0) {
      chips.push(IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP);
    }
    return orderEnvFirst(
      filterImplementationChipsForMessageContext({ chips, context: "execution_board" }),
      input.envOk !== false,
    );
  }

  if (developerDoneCount === 0 && !developerInProgress) {
    return orderEnvFirst(
      filterImplementationChipsForMessageContext({ chips, context: "execution_board" }),
      input.envOk !== false,
    );
  }

  if (developerInProgress) {
    return orderEnvFirst(
      filterImplementationChipsForMessageContext({ chips, context: "execution_board" }),
      input.envOk !== false,
    );
  }

  if (developerDoneCount > 0) {
    chips.push(REVIEWER_CHECK_CHIP);
  }
  if (reviewerDoneCount > 0) {
    chips.push(SECURITY_CHECK_CHIP);
  }
  if (developerDoneCount > 0) {
    chips.push(DESIGNER_REVIEW_CHIP);
  }

  const integrationUnlocked = board.integratedRows.some(
    (row) => row.step === "refactor_common" && row.status !== "not_started",
  );
  if (allTasksComplete || integrationUnlocked) {
    chips.push(
      ...deriveIntegratedStageInterviewChips(board, {
        integrationPipelineUnlocked: allTasksComplete || integrationUnlocked,
      }),
    );
    const testReadiness = deriveImplementationUserTestReadiness({
      board,
      previewReady: input.previewReady === true,
      hasTaskList: true,
      hasExecutionState: input.hasExecutionState !== false,
      boardState: input.boardState,
    });
    if (testReadiness.reviewStageMoveAllowed) {
      chips.push(MOVE_TO_REVIEW_STAGE_CHIP);
    }
  }

  if (board.summary.userConfirmationRequired > 0) {
    chips.push(IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP);
  }

  return orderEnvFirst(
    filterImplementationChipsForMessageContext({ chips, context: "execution_board" }),
    input.envOk !== false,
  );
}

/** Chips for task-list detail / role-check messages (not the board itself). */
export function deriveTaskListDetailInterviewChips(input: {
  readonly envOk?: boolean;
  readonly includeBoardChip?: boolean;
}): readonly string[] {
  const chips: string[] = [IMPLEMENTATION_GENERATION_REQUEST_CHIP];
  if (input.includeBoardChip !== false) {
    chips.push(IMPLEMENTATION_EXECUTION_BOARD_CHIP);
  }
  chips.push(IMPLEMENTATION_ENV_SETTINGS_LABEL);
  return orderEnvFirst(
    filterImplementationChipsForMessageContext({ chips, context: "task_list_detail" }),
    input.envOk !== false,
  );
}

/** Chips for reviewer/security/scm role result messages. */
export function deriveRoleCheckResultInterviewChips(input: {
  readonly envOk?: boolean;
}): readonly string[] {
  return orderEnvFirst(
    filterImplementationChipsForMessageContext({
      chips: [
        IMPLEMENTATION_GENERATION_REQUEST_CHIP,
        IMPLEMENTATION_EXECUTION_BOARD_CHIP,
        IMPLEMENTATION_ENV_SETTINGS_LABEL,
      ],
      context: "quality_result",
    }),
    input.envOk !== false,
  );
}
