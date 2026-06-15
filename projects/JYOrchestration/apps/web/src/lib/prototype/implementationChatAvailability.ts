import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import {
  buildImplementationChatAvailabilityInput,
  computeImplementationChatCanChat,
  type ImplementationChatAvailabilityInput,
} from "@/lib/prototype/implementationChatAvailabilityInput";

export type ImplementationChatAvailabilityStatus =
  | "available"
  | "waiting_for_codetasks"
  | "waiting_for_github_verify"
  | "waiting_for_integration"
  | "waiting_for_preview"
  | "waiting_for_sample_data"
  | "sample_data_not_rendered"
  | "failed"
  | "not_started";

export type ImplementationChatAvailability = Readonly<{
  readonly canChat: boolean;
  readonly status: ImplementationChatAvailabilityStatus;
  readonly title: string;
  readonly message: string;
}>;

export const IMPLEMENTATION_CHAT_MOBILE_LOCKED_HINT =
  "Preview 준비 후 입력할 수 있습니다." as const;

/** @deprecated Prefer `ImplementationChatAvailabilityInput` from buildImplementationChatAvailabilityInput */
export type DeriveImplementationChatAvailabilitySignalsInput = ImplementationChatAvailabilityInput &
  Readonly<{
    readonly board: ImplementationExecutionBoardV1 | null;
    readonly integrationPipelineUnlocked: boolean;
    readonly activeTaskCursorRunning: boolean;
    readonly taskCursorGithubVerifying: boolean;
  }>;

function integratedStepStatus(
  board: ImplementationExecutionBoardV1 | null,
  step: "refactor_common" | "integrated_review" | "integrated_security" | "final_scm",
): string | undefined {
  return board?.integratedRows.find((row) => row.step === step)?.status;
}

function resolveAvailabilityStatus(
  input: DeriveImplementationChatAvailabilitySignalsInput,
): Omit<ImplementationChatAvailability, "canChat"> {
  if (!input.implementationStarted) {
    return {
      status: "not_started",
      title: "구현 작업이 아직 시작되지 않았습니다.",
      message:
        "CodeTask 작업과 Preview 생성이 완료되면 보완요청을 입력할 수 있습니다.",
    };
  }

  if (input.hasFailedTasks) {
    return {
      status: "failed",
      title: "일부 CodeTask가 실패했습니다.",
      message:
        "실패 Task를 재작업하거나 독립 Task 실행을 계속 진행해 주세요. Preview가 준비되면 보완요청을 입력할 수 있습니다.",
    };
  }

  const strictCanChat = computeImplementationChatCanChat(input);
  if (strictCanChat) {
    return {
      status: "available",
      title: "Preview가 준비되었습니다.",
      message: "Preview를 확인한 뒤 보완요청을 입력할 수 있습니다.",
    };
  }

  const inProgressTasks = input.board?.summary.inProgressTasks ?? 0;
  if (input.activeTaskCursorRunning || inProgressTasks > 0) {
    return {
      status: "waiting_for_codetasks",
      title: "CodeTask 작업을 진행 중입니다.",
      message: "Preview가 생성된 후 보완요청을 입력할 수 있습니다.",
    };
  }

  if (!input.integrationPipelineUnlocked) {
    if (input.taskCursorGithubVerifying) {
      return {
        status: "waiting_for_github_verify",
        title: "GitHub 작업 결과를 확인 중입니다.",
        message: "Preview가 준비되면 보완요청을 입력할 수 있습니다.",
      };
    }
    return {
      status: "waiting_for_codetasks",
      title: "CodeTask 작업을 진행 중입니다.",
      message: "Preview가 생성된 후 보완요청을 입력할 수 있습니다.",
    };
  }

  const refactorDone = integratedStepStatus(input.board, "refactor_common") === "done";
  const integratedInProgress = (input.board?.integratedRows ?? []).some(
    (row) => row.status === "in_progress" || row.status === "queued",
  );
  if (!refactorDone || integratedInProgress) {
    return {
      status: "waiting_for_integration",
      title: "작업 결과를 통합 중입니다.",
      message: "Preview가 준비되면 보완요청을 입력할 수 있습니다.",
    };
  }

  if (input.taskCursorGithubVerifying) {
    return {
      status: "waiting_for_github_verify",
      title: "GitHub 작업 결과를 확인 중입니다.",
      message: "Preview가 준비되면 보완요청을 입력할 수 있습니다.",
    };
  }

  if (!input.previewReady || !String(input.previewUrl ?? "").trim() || input.previewOpenTargetReady === false) {
    return {
      status: "waiting_for_preview",
      title: "Preview를 생성 중입니다.",
      message: "Preview가 준비되면 보완요청을 입력할 수 있습니다.",
    };
  }

  if (
    input.sampleDataRequired &&
    (!input.sampleDataQualityOk || !input.sampleDataRenderedOk)
  ) {
    if (
      input.sampleDataStatus === "not_rendered" ||
      input.sampleDataStatus === "wiring_failed"
    ) {
      return {
        status: "sample_data_not_rendered",
        title: "샘플 데이터 미반영",
        message:
          "Preview는 생성되었지만 샘플 회의파일과 참여자 정보가 표시되지 않았습니다. 샘플 데이터 반영 후 보완요청을 입력할 수 있습니다.",
      };
    }
    if (!input.sampleDataQualityOk) {
      return {
        status: "waiting_for_sample_data",
        title: "Preview 샘플 데이터를 확인 중입니다.",
        message:
          "샘플 회의파일과 참여자 정보가 화면에 표시되면 보완요청을 입력할 수 있습니다.",
      };
    }
    return {
      status: "waiting_for_sample_data",
      title: "Preview 샘플 데이터를 확인 중입니다.",
      message:
        "샘플 회의파일과 참여자 정보가 화면에 표시되면 보완요청을 입력할 수 있습니다.",
    };
  }

  return {
    status: "waiting_for_preview",
    title: "Preview를 생성 중입니다.",
    message: "Preview가 준비되면 보완요청을 입력할 수 있습니다.",
  };
}

export function resolveImplementationChatAvailability(
  input: DeriveImplementationChatAvailabilitySignalsInput,
): ImplementationChatAvailability {
  const statusFields = resolveAvailabilityStatus(input);
  const canChat = computeImplementationChatCanChat(input);
  return { canChat, ...statusFields };
}

export function deriveImplementationChatAvailabilitySignals(input: Readonly<{
  readonly board: ImplementationExecutionBoardV1 | null;
  readonly integrationPipelineUnlocked: boolean;
  readonly activeTaskCursorRunning: boolean;
  readonly taskCursorGithubVerifying: boolean;
  readonly availabilityInput: ImplementationChatAvailabilityInput;
}>): DeriveImplementationChatAvailabilitySignalsInput {
  return {
    ...input.availabilityInput,
    board: input.board,
    integrationPipelineUnlocked: input.integrationPipelineUnlocked,
    activeTaskCursorRunning: input.activeTaskCursorRunning,
    taskCursorGithubVerifying: input.taskCursorGithubVerifying,
  };
}

export function implementationChatComposerPlaceholder(
  availability: ImplementationChatAvailability,
): string {
  if (availability.canChat) {
    return "Preview를 확인한 뒤 보완요청을 입력하세요.";
  }
  return IMPLEMENTATION_CHAT_MOBILE_LOCKED_HINT;
}

export { buildImplementationChatAvailabilityInput, computeImplementationChatCanChat } from "@/lib/prototype/implementationChatAvailabilityInput";
