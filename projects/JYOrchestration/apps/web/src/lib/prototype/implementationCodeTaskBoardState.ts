export type ImplementationCodeTaskBoardStateV1 = Readonly<{
  readonly codeTaskId: string;
  readonly statusLabel: string;
  readonly progressLabel: string;
  readonly title: string;
  readonly isCompleted: boolean;
  readonly isRunning: boolean;
  readonly isBlocked: boolean;
  readonly isRunnableForUser: boolean;
  readonly isIntegrationReady: boolean;
  readonly checkboxDisabled: boolean;
  readonly checkboxDisabledReason: string | null;
}>;

const COMPLETED_REASON = "이미 완료된 작업입니다. 통합 시 자동 포함됩니다." as const;
const RUNNING_REASON = "현재 실행 중인 작업은 선택할 수 없습니다." as const;
const BLOCKED_REASON = "의존 작업이 완료되지 않아 아직 실행할 수 없습니다." as const;

function progressIndicatesRunnable(progressLabel: string): boolean {
  const p = progressLabel.trim();
  return p === "실행 가능" || p.includes("실행 가능") || p === "Quick 실행 대기";
}

export function resolveCodeTaskBoardState(input: {
  readonly codeTaskId: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly progressLabel: string;
  readonly githubOutcomeSaved?: boolean;
  readonly commitSha?: string | null;
  readonly branchName?: string | null;
  readonly noCodeChangeEvidence?: boolean | null;
  readonly isChecked?: boolean;
}): ImplementationCodeTaskBoardStateV1 {
  const statusLabel = String(input.statusLabel ?? "").trim();
  const progressLabel = String(input.progressLabel ?? "").trim();
  const githubOutcomeSaved = input.githubOutcomeSaved === true;

  const isCompleted =
    statusLabel === "완료" ||
    progressLabel === "GitHub outcome 저장됨" ||
    progressLabel.includes("GitHub outcome") ||
    progressLabel.includes("outcome 저장") ||
    githubOutcomeSaved;

  const isRunning =
    progressLabel === "실행 중" ||
    progressLabel.includes("실행 중") ||
    progressLabel.includes("검증 중") ||
    statusLabel === "실행 중";

  const isBlocked = statusLabel.includes("차단") || progressLabel.includes("차단");

  const isRunnableForUser =
    !isCompleted && !isRunning && !isBlocked && progressIndicatesRunnable(progressLabel);

  const isIntegrationReady =
    isCompleted &&
    githubOutcomeSaved &&
    Boolean(
      String(input.commitSha ?? "").trim() ||
        String(input.branchName ?? "").trim() ||
        input.noCodeChangeEvidence === true,
    );

  let checkboxDisabledReason: string | null = null;
  if (isCompleted) {
    checkboxDisabledReason = COMPLETED_REASON;
  } else if (isRunning) {
    checkboxDisabledReason = RUNNING_REASON;
  } else if (isBlocked) {
    checkboxDisabledReason = BLOCKED_REASON;
  } else if (!isRunnableForUser) {
    checkboxDisabledReason = "현재 실행할 수 없는 CodeTask입니다.";
  }

  const checkboxDisabled = !isRunnableForUser && input.isChecked !== true;

  const state: ImplementationCodeTaskBoardStateV1 = {
    codeTaskId: input.codeTaskId.trim(),
    statusLabel,
    progressLabel,
    title: input.title.trim(),
    isCompleted,
    isRunning,
    isBlocked,
    isRunnableForUser,
    isIntegrationReady,
    checkboxDisabled,
    checkboxDisabledReason,
  };

  console.info(
    JSON.stringify({
      action: "codetask_board_state_resolved",
      codeTaskId: state.codeTaskId,
      title: state.title,
      statusLabel: state.statusLabel,
      progressLabel: state.progressLabel,
      isRunnableForUser: state.isRunnableForUser,
      isIntegrationReady: state.isIntegrationReady,
      checkboxDisabled: state.checkboxDisabled,
      checkboxDisabledReason: state.checkboxDisabledReason,
    }),
  );

  return state;
}

export function summarizeCodeTaskBoardRowsFromTreeNodes(input: {
  readonly nodes: readonly { readonly codeTaskId: string; readonly boardState: ImplementationCodeTaskBoardStateV1 }[];
  readonly selectedCodeTaskIds?: readonly string[] | null;
}): Readonly<{
  readonly totalCount: number;
  readonly runnableCount: number;
  readonly selectedCount: number;
  readonly selectedRunnableCount: number;
  readonly integrationReadyCount: number;
  readonly incompleteCount: number;
}> {
  const selectedSet = new Set((input.selectedCodeTaskIds ?? []).map((id) => id.trim()).filter(Boolean));
  const runnableCount = input.nodes.filter((n) => n.boardState.isRunnableForUser).length;
  const integrationReadyCount = input.nodes.filter((n) => n.boardState.isIntegrationReady).length;
  const selected = input.nodes.filter((n) => selectedSet.has(n.codeTaskId.trim()));
  const selectedRunnableCount = selected.filter((n) => n.boardState.isRunnableForUser).length;

  const summary = {
    totalCount: input.nodes.length,
    runnableCount,
    selectedCount: selected.length,
    selectedRunnableCount,
    integrationReadyCount,
    incompleteCount: Math.max(0, input.nodes.length - integrationReadyCount),
  };

  console.info(
    JSON.stringify({
      action: "codetask_runnable_summary_resolved",
      totalCount: summary.totalCount,
      runnableCount: summary.runnableCount,
      selectedRunnableCount: summary.selectedRunnableCount,
      integrationReadyCount: summary.integrationReadyCount,
    }),
  );

  return summary;
}

export function listRunnableCodeTaskIdsFromBoardNodes(
  nodes: readonly { readonly codeTaskId: string; readonly boardState: ImplementationCodeTaskBoardStateV1 }[],
): readonly string[] {
  return nodes.filter((n) => n.boardState.isRunnableForUser).map((n) => n.codeTaskId.trim()).filter(Boolean);
}

export function evaluateSelectedRunnableCodeTasksGateFromBoard(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly runnableCodeTaskIds: readonly string[];
}): Readonly<{ readonly ok: boolean; readonly message: string | null; readonly runnableIds: readonly string[] }> {
  const runnableSet = new Set(input.runnableCodeTaskIds.map((id) => id.trim()).filter(Boolean));
  const selected = [...new Set(input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean))];
  const runnableIds = selected.filter((id) => runnableSet.has(id));

  if (!selected.length) {
    return { ok: false, message: "실행할 CodeTask를 선택해 주세요.", runnableIds: [] };
  }
  if (!runnableIds.length) {
    console.info(JSON.stringify({ action: "execute_selected_runnable_codetasks_rejected_empty" }));
    return {
      ok: false,
      message: "실행 가능한 선택 작업이 없습니다.",
      runnableIds: [],
    };
  }
  console.info(
    JSON.stringify({
      action: "execute_selected_runnable_codetasks_requested",
      runnableCount: runnableIds.length,
    }),
  );
  return { ok: true, message: null, runnableIds };
}
