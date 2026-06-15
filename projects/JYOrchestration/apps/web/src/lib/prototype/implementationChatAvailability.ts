import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";

export type ImplementationChatAvailabilityStatus =
  | "available"
  | "waiting_for_codetasks"
  | "waiting_for_github_verify"
  | "waiting_for_integration"
  | "waiting_for_preview"
  | "failed"
  | "not_started";

export type ImplementationChatAvailability = Readonly<{
  readonly canChat: boolean;
  readonly status: ImplementationChatAvailabilityStatus;
  readonly title: string;
  readonly message: string;
}>;

export const IMPLEMENTATION_CHAT_MOBILE_LOCKED_HINT =
  "Preview 준비 후 보완요청을 입력할 수 있습니다." as const;

export type DeriveImplementationChatAvailabilitySignalsInput = Readonly<{
  readonly implementationStarted: boolean;
  readonly hasFailedTasks: boolean;
  readonly integrationPipelineUnlocked: boolean;
  readonly activeTaskCursorRunning: boolean;
  readonly taskCursorGithubVerifying: boolean;
  readonly board: ImplementationExecutionBoardV1 | null;
  readonly previewReady: boolean;
  readonly previewUrl: string | null;
}>;

function integratedStepStatus(
  board: ImplementationExecutionBoardV1 | null,
  step: "refactor_common" | "integrated_review" | "integrated_security" | "final_scm",
): string | undefined {
  return board?.integratedRows.find((row) => row.step === step)?.status;
}

export function resolveImplementationChatAvailability(
  input: DeriveImplementationChatAvailabilitySignalsInput,
): ImplementationChatAvailability {
  if (!input.implementationStarted) {
    return {
      canChat: false,
      status: "not_started",
      title: "구현 작업이 아직 시작되지 않았습니다.",
      message:
        "CodeTask 작업과 Preview 생성이 완료되면 보완요청을 입력할 수 있습니다.",
    };
  }

  if (input.hasFailedTasks) {
    return {
      canChat: false,
      status: "failed",
      title: "일부 CodeTask가 실패했습니다.",
      message:
        "실패 Task를 재작업하거나 독립 Task 실행을 계속 진행해 주세요. Preview가 준비되면 보완요청을 입력할 수 있습니다.",
    };
  }

  const previewUrl = input.previewUrl?.trim() || null;
  if (input.previewReady && previewUrl) {
    return {
      canChat: true,
      status: "available",
      title: "Preview가 준비되었습니다.",
      message: "Preview를 확인한 뒤 보완요청을 입력할 수 있습니다.",
    };
  }

  const inProgressTasks = input.board?.summary.inProgressTasks ?? 0;
  if (input.activeTaskCursorRunning || inProgressTasks > 0) {
    return {
      canChat: false,
      status: "waiting_for_codetasks",
      title: "CodeTask 작업을 진행 중입니다.",
      message: "Preview가 생성된 후 보완요청을 입력할 수 있습니다. 현재는 CodeTask 작업을 진행 중입니다.",
    };
  }

  if (!input.integrationPipelineUnlocked) {
    if (input.taskCursorGithubVerifying) {
      return {
        canChat: false,
        status: "waiting_for_github_verify",
        title: "GitHub 작업 결과를 확인 중입니다.",
        message: "Preview가 준비되면 보완요청을 입력할 수 있습니다.",
      };
    }
    return {
      canChat: false,
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
      canChat: false,
      status: "waiting_for_integration",
      title: "작업 결과를 통합 중입니다.",
      message: "Preview가 준비되면 보완요청을 입력할 수 있습니다.",
    };
  }

  if (input.taskCursorGithubVerifying) {
    return {
      canChat: false,
      status: "waiting_for_github_verify",
      title: "CodeTask 작업 결과를 GitHub에서 확인 중입니다.",
      message: "Preview가 준비되면 보완요청을 입력할 수 있습니다.",
    };
  }

  return {
    canChat: false,
    status: "waiting_for_preview",
    title: "Preview를 생성하고 있습니다.",
    message: "Preview가 준비되면 보완요청을 입력할 수 있습니다.",
  };
}

export function deriveImplementationChatAvailabilitySignals(input: Readonly<{
  readonly board: ImplementationExecutionBoardV1 | null;
  readonly previewReady: boolean;
  readonly previewUrl: string | null;
  readonly integrationPipelineUnlocked: boolean;
  readonly activeTaskCursorRunning: boolean;
  readonly taskCursorGithubVerifying: boolean;
  readonly implementationStarted: boolean;
}>): DeriveImplementationChatAvailabilitySignalsInput {
  const summary = input.board?.summary;
  const hasFailedTasks =
    (summary?.failedTasks ?? 0) > 0 || (summary?.reworkRequiredTasks ?? 0) > 0;

  return {
    implementationStarted: input.implementationStarted,
    hasFailedTasks,
    integrationPipelineUnlocked: input.integrationPipelineUnlocked,
    activeTaskCursorRunning: input.activeTaskCursorRunning,
    taskCursorGithubVerifying: input.taskCursorGithubVerifying,
    board: input.board,
    previewReady: input.previewReady,
    previewUrl: input.previewUrl,
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
