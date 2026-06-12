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
export const COMPLETED_CODE_TASK_CHECKBOX_DISABLED_REASON = "completed" as const;

export function resolveCodeTaskCheckboxDisabledTitle(reason: string | null): string | null {
  if (reason === COMPLETED_CODE_TASK_CHECKBOX_DISABLED_REASON) return COMPLETED_REASON;
  return reason;
}
const RUNNING_REASON = "현재 실행 중인 작업은 선택할 수 없습니다." as const;
const BLOCKED_REASON = "의존 작업이 완료되지 않아 아직 실행할 수 없습니다." as const;

function progressIndicatesRunnable(progressLabel: string): boolean {
  const p = progressLabel.trim();
  return p === "실행 가능" || p.includes("실행 가능") || p === "Quick 실행 대기";
}

function labelIndicatesRunnable(statusLabel: string, progressLabel: string): boolean {
  const s = statusLabel.trim();
  return (
    progressIndicatesRunnable(progressLabel) ||
    s === "대기" ||
    s === "준비" ||
    s === "대기열" ||
    s === "실패"
  );
}

export function coalesceCodeTaskBoardRowDisplayLabels(input: {
  readonly statusLabel: string;
  readonly progressLabel: string;
  readonly collapsedSummary?: string | null;
  readonly promptReadyPhase?: boolean;
  readonly rowStatusLabel?: string | null;
  readonly rowProgressLabel?: string | null;
  readonly rowCollapsedSummary?: string | null;
  /** GitHub outcome / commit / no-code-change — do not downgrade row to 대기·실행 가능. */
  readonly completionEvidenceLocked?: boolean;
}): Readonly<{ readonly statusLabel: string; readonly progressLabel: string }> {
  if (input.completionEvidenceLocked === true) {
    const pick = (...candidates: readonly (string | null | undefined)[]): string => {
      for (const candidate of candidates) {
        const trimmed = String(candidate ?? "").trim();
        if (trimmed) return trimmed;
      }
      return "";
    };
    const rawProgress = pick(input.progressLabel, input.rowProgressLabel);
    const progressLabel =
      rawProgress &&
      !progressIndicatesRunnable(rawProgress) &&
      (labelIndicatesCompleted("완료", rawProgress) || rawProgress.includes("통합"))
        ? rawProgress
        : "GitHub outcome 저장됨";
    return { statusLabel: "완료", progressLabel };
  }

  const pick = (...candidates: readonly (string | null | undefined)[]): string => {
    for (const candidate of candidates) {
      const trimmed = String(candidate ?? "").trim();
      if (trimmed) return trimmed;
    }
    return "";
  };

  let statusLabel = pick(input.statusLabel, input.rowStatusLabel);
  let progressLabel = pick(input.progressLabel, input.rowProgressLabel);
  const collapsedSummary = String(input.collapsedSummary ?? "").trim();
  const rowCollapsedSummary = String(input.rowCollapsedSummary ?? "").trim();
  const rowWaiting =
    rowCollapsedSummary === "대기" ||
    String(input.rowStatusLabel ?? "").trim() === "대기" ||
    collapsedSummary === "대기";

  if (
    rowWaiting &&
    labelIndicatesCompleted(statusLabel, progressLabel) &&
    !progressIndicatesRunnable(progressLabel)
  ) {
    statusLabel = "대기";
    progressLabel = progressIndicatesRunnable(String(input.rowProgressLabel ?? ""))
      ? String(input.rowProgressLabel).trim()
      : "실행 가능";
    return { statusLabel, progressLabel };
  }

  if (!statusLabel && collapsedSummary) {
    if (
      collapsedSummary === "대기" ||
      collapsedSummary === "완료" ||
      collapsedSummary === "실패" ||
      collapsedSummary === "실행 중"
    ) {
      statusLabel = collapsedSummary;
    }
  }

  const waitingByVisibleSummary =
    collapsedSummary === "대기" || input.promptReadyPhase === true || statusLabel === "대기";

  if (waitingByVisibleSummary) {
    statusLabel = "대기";
    progressLabel = progressIndicatesRunnable(progressLabel) ? progressLabel.trim() : "실행 가능";
    return { statusLabel, progressLabel };
  }

  if (statusLabel === "대기" && !progressLabel) {
    progressLabel = "실행 가능";
  }

  return { statusLabel, progressLabel };
}

function labelIndicatesCompleted(statusLabel: string, progressLabel: string): boolean {
  const s = statusLabel.trim();
  const p = progressLabel.trim();
  return (
    s === "완료" ||
    p === "완료" ||
    p === "GitHub outcome 저장됨" ||
    p.includes("GitHub outcome") ||
    p.includes("outcome 저장")
  );
}

export type ImplementationCodeTaskSelectionSummaryV1 = Readonly<{
  readonly totalCount: number;
  readonly runnableCount: number;
  readonly selectedRunnableCount: number;
  readonly selectedRunnableCodeTaskIds: readonly string[];
  readonly integrationReadyCount: number;
  readonly integrationReadyCodeTaskIds: readonly string[];
}>;

function hasCodeTaskCompletionEvidence(input: {
  readonly githubOutcomeSaved?: boolean;
  readonly commitSha?: string | null;
  readonly noCodeChangeEvidence?: boolean | null;
}): boolean {
  return (
    input.githubOutcomeSaved === true ||
    Boolean(String(input.commitSha ?? "").trim()) ||
    input.noCodeChangeEvidence === true
  );
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
  let statusLabel = String(input.statusLabel ?? "").trim();
  let progressLabel = String(input.progressLabel ?? "").trim();
  const githubOutcomeSaved = input.githubOutcomeSaved === true;
  const completionEvidence = hasCodeTaskCompletionEvidence(input);

  const runnableByDisplayLabels = labelIndicatesRunnable(statusLabel, progressLabel);
  const completedByDisplayLabels = labelIndicatesCompleted(statusLabel, progressLabel);

  const isRunning =
    progressLabel === "실행 중" ||
    progressLabel.includes("실행 중") ||
    progressLabel.includes("검증 중") ||
    statusLabel === "실행 중";

  const isBlocked = statusLabel.includes("차단") || progressLabel.includes("차단");

  let isCompleted =
    completionEvidence ||
    statusLabel === "완료" ||
    (completedByDisplayLabels && !runnableByDisplayLabels);

  const hasIntegrationEvidence =
    githubOutcomeSaved ||
    Boolean(String(input.commitSha ?? "").trim()) ||
    input.noCodeChangeEvidence === true;

  if (statusLabel === "완료" && progressIndicatesRunnable(progressLabel)) {
    isCompleted = true;
    progressLabel =
      completionEvidence && (githubOutcomeSaved || String(input.commitSha ?? "").trim())
        ? "GitHub outcome 저장됨"
        : progressLabel.includes("통합")
          ? progressLabel
          : "GitHub outcome 저장됨";
  }

  if (isCompleted && progressIndicatesRunnable(progressLabel)) {
    progressLabel =
      hasIntegrationEvidence && (githubOutcomeSaved || String(input.commitSha ?? "").trim())
        ? "GitHub outcome 저장됨"
        : "통합 가능";
  }

  if (isCompleted && statusLabel !== "완료" && !isRunning && !isBlocked) {
    statusLabel = "완료";
  }

  const isRunnableForUser =
    !isCompleted &&
    !completionEvidence &&
    !isRunning &&
    !isBlocked &&
    runnableByDisplayLabels;

  const isIntegrationReady = isCompleted && hasIntegrationEvidence;

  let checkboxDisabledReason: string | null = null;
  if (isCompleted) {
    checkboxDisabledReason = "completed";
  } else if (isRunning) {
    checkboxDisabledReason = RUNNING_REASON;
  } else if (isBlocked) {
    checkboxDisabledReason = BLOCKED_REASON;
  } else if (!isRunnableForUser) {
    checkboxDisabledReason = "현재 실행할 수 없는 CodeTask입니다.";
  }

  const checkboxDisabled = !isRunnableForUser;

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
  /** Checkbox SoT (preferred). */
  readonly checkedCodeTaskIds?: readonly string[] | null;
  /** @deprecated use checkedCodeTaskIds */
  readonly selectedCodeTaskIds?: readonly string[] | null;
}): ImplementationCodeTaskSelectionSummaryV1 &
  Readonly<{
    readonly selectedCount: number;
    readonly incompleteCount: number;
  }> {
  const checked = input.checkedCodeTaskIds ?? input.selectedCodeTaskIds ?? [];
  const selectedSet = new Set(checked.map((id) => id.trim()).filter(Boolean));
  const runnableCount = input.nodes.filter((n) => n.boardState.isRunnableForUser).length;
  const integrationReadyNodes = input.nodes.filter((n) => n.boardState.isIntegrationReady);
  const integrationReadyCount = integrationReadyNodes.length;
  const integrationReadyCodeTaskIds = integrationReadyNodes
    .map((n) => n.codeTaskId.trim())
    .filter(Boolean);
  const selected = input.nodes.filter((n) => selectedSet.has(n.codeTaskId.trim()));
  const selectedRunnableNodes = selected.filter((n) => n.boardState.isRunnableForUser);
  const selectedRunnableCount = selectedRunnableNodes.length;
  const selectedRunnableCodeTaskIds = selectedRunnableNodes
    .map((n) => n.codeTaskId.trim())
    .filter(Boolean);

  const summary = {
    totalCount: input.nodes.length,
    runnableCount,
    selectedCount: selected.length,
    selectedRunnableCount,
    selectedRunnableCodeTaskIds,
    integrationReadyCount,
    integrationReadyCodeTaskIds,
    incompleteCount: Math.max(0, input.nodes.length - integrationReadyCount),
  };

  console.info(
    JSON.stringify({
      action: "implementation_selection_summary_resolved",
      totalCount: summary.totalCount,
      runnableCount: summary.runnableCount,
      selectedRunnableCount: summary.selectedRunnableCount,
      selectedRunnableCodeTaskIds: summary.selectedRunnableCodeTaskIds,
      integrationReadyCount: summary.integrationReadyCount,
      integrationReadyCodeTaskIds: summary.integrationReadyCodeTaskIds,
    }),
  );

  return summary;
}

export function logImplementationBoardSelectionSummaryResolved(input: {
  readonly projectId?: string | null;
  readonly summary: ImplementationCodeTaskSelectionSummaryV1 &
    Readonly<{ readonly selectedCount?: number; readonly incompleteCount?: number }>;
}): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info(
    JSON.stringify({
      action: "implementation_board_selection_summary_resolved",
      projectId: input.projectId ?? null,
      totalCount: input.summary.totalCount,
      runnableCount: input.summary.runnableCount,
      selectedRunnableCount: input.summary.selectedRunnableCount,
      selectedRunnableCodeTaskIds: input.summary.selectedRunnableCodeTaskIds,
      integrationReadyCount: input.summary.integrationReadyCount,
    }),
  );
}

export function listRunnableCodeTaskIdsFromBoardNodes(
  nodes: readonly { readonly codeTaskId: string; readonly boardState: ImplementationCodeTaskBoardStateV1 }[],
): readonly string[] {
  return nodes.filter((n) => n.boardState.isRunnableForUser).map((n) => n.codeTaskId.trim()).filter(Boolean);
}

/** Board checkbox: user may toggle only rows whose displayed status is 대기. */
export function isCodeTaskWaitingForUserCheckboxSelection(statusLabel: string): boolean {
  return String(statusLabel ?? "").trim() === "대기";
}

export function listWaitingCodeTaskIdsFromBoardNodes(
  nodes: readonly { readonly codeTaskId: string; readonly boardState: ImplementationCodeTaskBoardStateV1 }[],
): readonly string[] {
  return nodes
    .filter((n) => isCodeTaskWaitingForUserCheckboxSelection(n.boardState.statusLabel))
    .map((n) => n.codeTaskId.trim())
    .filter(Boolean);
}

/** Checkbox selection: any row the board marks as user-toggleable (not completed/running/blocked). */
export function listUserCheckboxSelectableCodeTaskIdsFromBoardNodes(
  nodes: readonly { readonly codeTaskId: string; readonly boardState: ImplementationCodeTaskBoardStateV1 }[],
): readonly string[] {
  return nodes
    .filter((n) => !n.boardState.checkboxDisabled)
    .map((n) => n.codeTaskId.trim())
    .filter(Boolean);
}

/** Drop checked ids that are no longer user-selectable (e.g. after GitHub verify completes). */
export function pruneCheckedCodeTaskIdsToSelectableBoardRows(input: {
  readonly nodes: readonly { readonly codeTaskId: string; readonly boardState: ImplementationCodeTaskBoardStateV1 }[];
  readonly checkedCodeTaskIds: readonly string[];
}): readonly string[] {
  const selectable = new Set(listUserCheckboxSelectableCodeTaskIdsFromBoardNodes(input.nodes));
  return [...new Set(input.checkedCodeTaskIds.map((id) => id.trim()).filter(Boolean))].filter((id) =>
    selectable.has(id),
  );
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
