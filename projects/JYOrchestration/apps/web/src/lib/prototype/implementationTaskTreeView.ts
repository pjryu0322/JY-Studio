import {
  summarizeCodeTaskConflictRisk,
} from "@/lib/prototype/codeTaskFileConflictPlanner";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import {
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { isCodeTaskRunIntegrationReady } from "@/lib/prototype/codeTaskIntegrationReadiness";
import {
  buildCodeTaskRowView,
  summarizeCodeTaskRowViewsForProcess,
} from "@/lib/prototype/codeTaskExecutionRunView";
import { formatCodeTaskExecutionRunStatusKo } from "@/lib/prototype/codeTaskExecutionRunUi";
import {
  isProcessTaskCodeTasksFullySelected,
  normalizeSelectedCodeTaskIds,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import { PROMPT_PREFLIGHT_USER_BLOCK_MESSAGE } from "@/lib/prototype/codeTaskPromptPreflightFailure";
import { normalizeCodeTaskDisplayLabel } from "@/lib/prototype/codeTaskDisplayNameNormalize";
import { isSampleDataCodeTaskRef } from "@/lib/prototype/sampleDataCodeTaskPlanner";
import {
  deriveCodeTaskRunPhase,
  deriveCodeTaskRunProgressSteps,
} from "@/lib/prototype/codeTaskRunDerivedView";
import { resolveCursorSessionForRunPhase } from "@/lib/prototype/cursorSessionModel";
import type {
  ImplementationBoardStepStatus,
  ImplementationExecutionBoardTaskRowV1,
  ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import { isPerTaskPipelineComplete } from "@/lib/prototype/implementationTaskPipelinePolicy";
import { formatCodeTaskExecutionFlowPhaseKo } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  computeTaskTreeDependencyViews,
  orderTaskRowsForTreeDisplay,
} from "@/lib/prototype/implementationTaskTreeSelection";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { resolveTaskCursorExecutionForRow } from "@/lib/prototype/codeAgentExecutionProgressView";
import { buildTaskCursorGithubVerifyDiagnosticsView } from "@/lib/prototype/taskCursorGithubVerifyView";
import type { ImplementationRuntimeRunView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  formatExecutionUnitVerificationCardLabels,
  resolveExecutionUnitVerificationDisplayStatus,
} from "@/lib/prototype/implementationExecutionUnitVerification";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { CodeTaskManualGithubRecheckPayloadV1 } from "@/lib/prototype/codeTaskManualGithubRecheckPayload";
import {
  coalesceCodeTaskBoardRowDisplayLabels,
  resolveCodeTaskBoardState,
  resolveCodeTaskCheckboxDisabledTitle,
  type ImplementationCodeTaskBoardStateV1,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveAuthoritativeCodeTaskOutcome } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";

function resolveCodeTaskTreeRowUnitDisplayLabels(input: {
  readonly codeTaskId: string;
  readonly executionUnit?: ImplementationExecutionUnitV1 | null;
  readonly runs: readonly CodeTaskExecutionRunV1[];
}): Readonly<{ readonly statusLabel: string; readonly progressLabel: string }> {
  if (!input.executionUnit) {
    return { statusLabel: "", progressLabel: "" };
  }
  const run = findLatestRunForCodeTask(input.runs, input.codeTaskId);
  const display = resolveExecutionUnitVerificationDisplayStatus({
    unit: input.executionUnit,
    run,
  });
  const card = formatExecutionUnitVerificationCardLabels(display);
  return { statusLabel: card.statusLabel, progressLabel: card.progressLabel };
}

export type ImplementationTaskTreeMetaLine = Readonly<{
  readonly label: string;
  readonly value: string;
}>;

export type ImplementationCodeTaskTreeNode = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly title: string;
  readonly metaLines: readonly ImplementationTaskTreeMetaLine[];
  readonly collapsedSummary: string;
  readonly executionFlowSteps: readonly import("@/lib/prototype/implementationCodeTaskExecutionFlow").CodeTaskExecutionFlowStepVm[];
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly isChecked: boolean;
  readonly boardState: ImplementationCodeTaskBoardStateV1;
  readonly checkboxDisabled?: boolean;
  readonly checkboxDisabledTitle?: string | null;
  readonly checkboxDisabledReason?: string | null;
  readonly failureReason?: string;
  readonly nextActionHint?: string;
  readonly retryFailedActionLabel?: string;
  readonly showRetryFailedAction?: boolean;
  readonly pollStatusLabel?: string;
  readonly githubVerifyTechnicalLines?: readonly ImplementationTaskTreeMetaLine[];
  readonly githubRecheckPayload?: CodeTaskManualGithubRecheckPayloadV1;
  /** 샘플 데이터 CodeTask — GitHub branch 산출물 보기/다운로드 */
  readonly isSampleDataCodeTask?: boolean;
}>;

export type ImplementationProcessTaskTreeNode = Readonly<{
  readonly taskId: string;
  readonly title: string;
  readonly metaLines: readonly ImplementationTaskTreeMetaLine[];
  readonly collapsedSummary: string;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly isChecked: boolean;
  readonly treeDepth: number;
  readonly defaultExpanded: boolean;
  readonly codeTasks: readonly ImplementationCodeTaskTreeNode[];
  /** @deprecated Process Task는 직접 실행하지 않음 — CodeTask 버튼 사용 */
  readonly canRestart: boolean;
  readonly canStop?: boolean;
  readonly pollStatusLabel?: string;
  readonly restartBlockedReason?: string;
  readonly needsReworkRegistration: boolean;
}>;

/** @deprecated flat step — kept for legacy tests; prefer codeTasks + executionFlowSteps */
export type ImplementationTaskTreeChildStep = Readonly<{
  readonly roleLabel: string;
  readonly statusLabel: string;
}>;

/** @deprecated use ImplementationProcessTaskTreeNode */
export type ImplementationTaskTreeNode = ImplementationProcessTaskTreeNode;

export function stripLeadingTaskIdFromTitle(taskId: string, title: string): string {
  const id = taskId.trim();
  const t = title.trim();
  if (!id || !t) return t || id;
  if (t.startsWith(`${id} `)) return t.slice(id.length + 1).trim();
  if (t.startsWith(id)) return t.replace(new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\-–—:]+`), "").trim();
  return t;
}

function formatMetaLine(label: string, value: string): ImplementationTaskTreeMetaLine {
  return { label, value };
}

function formatBoardStepStatusKo(status: ImplementationBoardStepStatus): string {
  switch (status) {
    case "not_started":
      return "대기";
    case "ready":
      return "준비";
    case "queued":
      return "대기열";
    case "in_progress":
      return "진행";
    case "done":
      return "완료";
    case "failed":
      return "실패";
    case "skipped":
      return "생략";
    default:
      return status;
  }
}

function resolveProcessProgressLabel(row: ImplementationExecutionBoardTaskRowV1): string {
  if (row.developerStatus === "in_progress") return "진행 중";
  if (row.developerStatus === "done" && isPerTaskPipelineComplete(row)) return "실행 가능";
  if (row.developerStatus === "done") return "개발 완료";
  if (row.developerStatus === "failed") return "재작업 필요";
  if (row.developerStatus === "ready" || row.developerStatus === "queued") return "실행 가능";
  return "Quick 실행 대기";
}

function resolveProcessStatusLabel(row: ImplementationExecutionBoardTaskRowV1): string {
  if (row.developerStatus === "failed") return "실패";
  if (isPerTaskPipelineComplete(row)) return "완료";
  if (row.developerStatus === "in_progress") return "실행 중";
  return formatBoardStepStatusKo(row.developerStatus);
}

function buildProcessMetaLines(row: ImplementationExecutionBoardTaskRowV1): readonly ImplementationTaskTreeMetaLine[] {
  return [
    formatMetaLine("상태", resolveProcessStatusLabel(row)),
    formatMetaLine("진행", resolveProcessProgressLabel(row)),
    formatMetaLine("역할", "AI 개발자"),
    formatMetaLine("ID", row.taskId),
  ];
}

function buildCodeTaskNode(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly row: ImplementationExecutionBoardTaskRowV1;
  readonly workItem?: CursorWorkItem | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
  readonly dbRuntimeRuns?: readonly ImplementationRuntimeRunView[] | null;
  readonly dbCurrentRun?: ImplementationRuntimeRunView | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly codeTaskExecutionRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly isChecked: boolean;
  /** DB Quick Run Job 순서 — 이 목록에 있으면 plan 그래프 선행 검사로 UI/phase를 막지 않는다. */
  readonly sequentialQuickRunCodeTaskIds?: readonly string[] | null;
  readonly promptTimeline?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[] | null;
  readonly executionUnit?: ImplementationExecutionUnitV1 | null;
  readonly runtimeSnapshotUnit?: import("@/lib/prototype/implementationRuntimeSnapshot").ImplementationRuntimeSnapshotV1["units"][number] | null;
  readonly projectId?: string | null;
  readonly targetRepository?: ProjectTargetRepository | null;
}): ImplementationCodeTaskTreeNode {
  const executionForParent = resolveTaskCursorExecutionForRow({
    taskId: input.row.taskId,
    taskCursorExecutionV1: input.taskCursorExecution,
    taskCursorExecutionHistoryV1: input.taskCursorExecutionHistory,
  });
  const baseRun = findLatestRunForCodeTask(input.codeTaskExecutionRuns, input.codeTask.codeTaskId);
  const executionForPhase = resolveCursorSessionForRunPhase(executionForParent, baseRun);
  const autoGateForCodeTask =
    input.autoGate?.taskId === input.codeTask.parentTaskId ? input.autoGate : null;
  const dbRun =
    input.dbCurrentRun?.codeTaskId === input.codeTask.codeTaskId
      ? input.dbCurrentRun
      : (input.dbRuntimeRuns?.find((run) => run.codeTaskId === input.codeTask.codeTaskId) ?? null);
  const latestRun = baseRun
    ? {
        ...baseRun,
        ...(dbRun?.commitSha ? { commitSha: dbRun.commitSha, branchHeadCommitSha: dbRun.commitSha } : {}),
      }
    : null;

  let phase = latestRun
    ? deriveCodeTaskRunPhase({
        run: latestRun,
        cursorSession: executionForPhase,
        autoGate: autoGateForCodeTask,
        dbRun,
      })
    : deriveCodeTaskRunPhase({
        run: {
          runId: "pending",
          version: "code_task_execution_run_v1",
          projectId: input.codeTaskPlan?.projectId ?? "",
          processTaskId: input.codeTask.parentTaskId,
          workItemId: "",
          codeTaskId: input.codeTask.codeTaskId,
          status: "queued",
          attemptNo: 1,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
        cursorSession: executionForPhase,
        autoGate: autoGateForCodeTask,
      });

  if (latestRun?.failureReason === "prompt_preflight_failed") {
    phase = "prompt_preflight_failed";
  }

  const executionFlowSteps = latestRun
    ? deriveCodeTaskRunProgressSteps({
        run: latestRun,
        codeTask: input.codeTask,
        cursorSession: executionForPhase,
        autoGate: autoGateForCodeTask,
      })
    : deriveCodeTaskRunProgressSteps({
        run: {
          runId: "pending",
          version: "code_task_execution_run_v1",
          projectId: input.codeTaskPlan?.projectId ?? "",
          processTaskId: input.codeTask.parentTaskId,
          workItemId: "",
          codeTaskId: input.codeTask.codeTaskId,
          status: "queued",
          attemptNo: 1,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
        codeTask: input.codeTask,
        cursorSession: executionForPhase,
        autoGate: autoGateForCodeTask,
      });
  const title = normalizeCodeTaskDisplayLabel(
    stripLeadingTaskIdFromTitle(input.codeTask.codeTaskId, input.codeTask.title),
  );
  const rowView = buildCodeTaskRowView({
    codeTask: input.codeTask,
    runs: input.codeTaskExecutionRuns,
    codeTaskPlan: input.codeTaskPlan,
  });

  const rowVisiblyWaiting =
    rowView.collapsedSummary === "대기" || rowView.statusLabel.trim() === "대기";
  let collapsedSummary = rowView.collapsedSummary || formatCodeTaskExecutionFlowPhaseKo(phase);
  if (phase === "prompt_ready") collapsedSummary = "대기";
  if (
    phase === "completed" &&
    input.runtimeSnapshotUnit?.displayStatus !== "failed" &&
    !rowVisiblyWaiting
  ) {
    collapsedSummary = "완료";
  }
  if (phase === "failed" && !input.runtimeSnapshotUnit) collapsedSummary = "재작업 필요";
  if (phase === "prompt_preflight_failed") collapsedSummary = "프롬프트 품질 검사 실패";

  let statusLabel = rowView.statusLabel;
  let progressLabel = rowView.progressLabel;

  let showRetryFailedAction = false;
  let retryFailedActionLabel: string | undefined;
  if (input.runtimeSnapshotUnit) {
    statusLabel = input.runtimeSnapshotUnit.statusLabel;
    progressLabel = input.runtimeSnapshotUnit.progressLabel;
    if (input.runtimeSnapshotUnit.displayStatus === "verified") collapsedSummary = "완료";
    else if (input.runtimeSnapshotUnit.displayStatus === "failed") collapsedSummary = "실패";
    else if (input.runtimeSnapshotUnit.displayStatus === "verification_inconsistent")
      collapsedSummary = "검증 완료 대기";
    else if (input.runtimeSnapshotUnit.displayStatus === "running") collapsedSummary = "실행 중";
    if (input.runtimeSnapshotUnit.displayStatus === "failed") {
      showRetryFailedAction = input.runtimeSnapshotUnit.retryable !== false;
      retryFailedActionLabel =
        input.runtimeSnapshotUnit.userActionLabel?.trim() || "실패 작업 다시 실행";
    }
  } else if (input.executionUnit) {
    const unitRun = findLatestRunForCodeTask(input.codeTaskExecutionRuns, input.codeTask.codeTaskId);
    const display = resolveExecutionUnitVerificationDisplayStatus({
      unit: input.executionUnit,
      run: unitRun,
    });
    const cardLabels = formatExecutionUnitVerificationCardLabels(display);
    statusLabel = cardLabels.statusLabel;
    progressLabel = cardLabels.progressLabel;
    if (display === "verified") collapsedSummary = "완료";
    else if (display === "verification_inconsistent") collapsedSummary = "검증 완료 대기";
  }

  const githubVerifyView =
    phase === "github_verifying" ||
    executionForParent?.status === "github_verifying" ||
    executionForParent?.failureReason === "github_verify_state_sync_failed"
      ? buildTaskCursorGithubVerifyDiagnosticsView({
          codeTaskId: input.codeTask.codeTaskId,
          execution: executionForParent,
          run: latestRun,
        })
      : null;
  if (githubVerifyView && !input.runtimeSnapshotUnit && !input.executionUnit) {
    progressLabel = githubVerifyView.progressLabel;
  }

  const labelsForSelection = resolveCodeTaskTreeRowUnitDisplayLabels({
    codeTaskId: input.codeTask.codeTaskId,
    executionUnit: input.executionUnit ?? null,
    runs: input.codeTaskExecutionRuns,
  });
  const snapshotStatus = String(input.runtimeSnapshotUnit?.statusLabel ?? "").trim();
  const snapshotProgress = String(input.runtimeSnapshotUnit?.progressLabel ?? "").trim();
  statusLabel = snapshotStatus || labelsForSelection.statusLabel || statusLabel;
  progressLabel = snapshotProgress || labelsForSelection.progressLabel || progressLabel;

  const unitOutcomeForBoard = input.executionUnit
    ? resolveAuthoritativeCodeTaskOutcome({
        unit: input.executionUnit,
        runs: input.codeTaskExecutionRuns,
      })
    : null;
  const githubOutcomeSavedForBoard =
    unitOutcomeForBoard?.hasPersistedGithubOutcome === true && unitOutcomeForBoard.status === "verified";
  const commitShaForBoard =
    input.runtimeSnapshotUnit?.latestCommitSha ??
    unitOutcomeForBoard?.commitSha ??
    latestRun?.commitSha ??
    null;
  const noCodeChangeForBoard =
    unitOutcomeForBoard?.latestOutcomeStatus === "no_code_change" ||
    latestRun?.status === "no_code_change_completed" ||
    Boolean(latestRun?.noCodeChangeEvidence?.trim());
  const completionEvidenceLocked =
    Boolean(String(commitShaForBoard ?? "").trim()) ||
    Boolean(String(latestRun?.branchHeadCommitSha ?? "").trim()) ||
    noCodeChangeForBoard;

  const coalescedDisplayLabels = coalesceCodeTaskBoardRowDisplayLabels({
    statusLabel,
    progressLabel,
    collapsedSummary,
    promptReadyPhase: phase === "prompt_ready",
    rowStatusLabel: rowView.statusLabel,
    rowProgressLabel: rowView.progressLabel,
    rowCollapsedSummary: rowView.collapsedSummary,
    completionEvidenceLocked,
  });
  statusLabel = coalescedDisplayLabels.statusLabel;
  progressLabel = coalescedDisplayLabels.progressLabel;

  const metaLines: ImplementationTaskTreeMetaLine[] = [
    formatMetaLine("상태", statusLabel),
    formatMetaLine("진행", progressLabel),
    formatMetaLine("역할", "AI 개발자"),
    formatMetaLine("ID", input.codeTask.codeTaskId),
  ];

  const boundary = parseCodeTaskFileBoundaryV1(input.codeTask.fileBoundary) ?? null;
  const conflictPlan = input.codeTaskPlan?.codeTaskConflictPlanV1 ?? null;
  const risk = summarizeCodeTaskConflictRisk(
    boundary,
    conflictPlan?.issues ?? [],
    input.codeTask.codeTaskId,
  );
  metaLines.push(formatMetaLine("파일 경계", risk.boundaryLabel));
  if (boundary?.conflictGroupId) {
    metaLines.push(formatMetaLine("충돌 그룹", boundary.conflictGroupId));
    metaLines.push(formatMetaLine("실행 정책", risk.policyLabel));
  }
  if (risk.riskLabel !== "낮음") {
    metaLines.push(formatMetaLine("충돌 가능성", risk.riskLabel));
    for (const file of risk.sharedFileLines.slice(0, 2)) {
      metaLines.push(formatMetaLine("공유 파일", file));
    }
  }
  const branchPlan = input.codeTask.branchPlan;
  if (branchPlan) {
    metaLines.push(formatMetaLine("Branch group", branchPlan.branchGroup));
    metaLines.push(formatMetaLine("Work branch", branchPlan.workBranch));
    metaLines.push(formatMetaLine("Base branch", branchPlan.baseBranch));
    metaLines.push(formatMetaLine("Execution", branchPlan.executionMode));
  } else {
    metaLines.push(formatMetaLine("Branch Plan", "보정 필요"));
  }

  let failureReason: string | undefined;
  if (input.runtimeSnapshotUnit?.displayStatus === "failed") {
    failureReason =
      input.runtimeSnapshotUnit.userSafeFailureReasonLine?.trim() ||
      input.runtimeSnapshotUnit.userSafeFailureMessage?.split("\n")[0]?.trim() ||
      "작업이 완료되지 않았습니다.";
  } else if (phase === "prompt_preflight_failed") {
    failureReason = PROMPT_PREFLIGHT_USER_BLOCK_MESSAGE;
  } else if (phase === "failed" && !input.runtimeSnapshotUnit) {
    failureReason = "작업이 완료되지 않았습니다.";
  }

  const unitOutcome = unitOutcomeForBoard;
  const githubOutcomeSaved =
    githubOutcomeSavedForBoard;

  console.info(
    JSON.stringify({
      action: "codetask_board_state_input_resolved",
      codeTaskId: input.codeTask.codeTaskId,
      title,
      statusLabel,
      progressLabel,
      githubOutcomeSaved,
      hasRuntimeSnapshotUnit: Boolean(input.runtimeSnapshotUnit),
      hasExecutionUnit: Boolean(input.executionUnit),
      unitStatus: input.executionUnit?.status ?? null,
      runtimeDisplayStatus: input.runtimeSnapshotUnit?.displayStatus ?? null,
    }),
  );

  const boardState = resolveCodeTaskBoardState({
    codeTaskId: input.codeTask.codeTaskId,
    title,
    statusLabel,
    progressLabel,
    githubOutcomeSaved,
    commitSha: commitShaForBoard ?? input.runtimeSnapshotUnit?.latestCommitSha ?? unitOutcome?.commitSha ?? null,
    githubBranchHeadCommit: latestRun?.branchHeadCommitSha ?? null,
    branchHeadCommit: latestRun?.branchHeadCommitSha ?? null,
    branchName: input.executionUnit?.workBranch ?? input.codeTask.branchPlan?.workBranch ?? null,
    noCodeChangeEvidence: noCodeChangeForBoard,
    isChecked: input.isChecked,
    runIntegrationReady: latestRun ? isCodeTaskRunIntegrationReady(latestRun) : null,
  });

  const checkboxDisabled = !boardState.isRunnableForUser;
  const checkboxDisabledTitle = resolveCodeTaskCheckboxDisabledTitle(boardState.checkboxDisabledReason);
  const checkboxDisabledReason = boardState.checkboxDisabledReason;

  for (let i = 0; i < metaLines.length; i += 1) {
    const line = metaLines[i];
    if (line?.label === "상태") {
      metaLines[i] = formatMetaLine("상태", boardState.statusLabel);
    } else if (line?.label === "진행") {
      metaLines[i] = formatMetaLine("진행", boardState.progressLabel);
    }
  }

  console.info(
    JSON.stringify({
      action: "codetask_checkbox_state_resolved",
      codeTaskId: boardState.codeTaskId,
      isRunnableForUser: boardState.isRunnableForUser,
      checkboxDisabled,
      checkboxDisabledReason,
    }),
  );

  const branchPlanForRecheck = parseCodeTaskBranchPlanV1(input.codeTask.branchPlan);
  const recheckWorkBranch =
    input.executionUnit?.workBranch?.trim() ||
    branchPlanForRecheck?.workBranch?.trim() ||
    dbRun?.branchName?.trim() ||
    boardState.branchName?.trim() ||
    "";
  const recheckBaseBranch =
    input.executionUnit?.baseBranch?.trim() ||
    branchPlanForRecheck?.baseBranch?.trim() ||
    "";
  const githubRecheckPayload: CodeTaskManualGithubRecheckPayloadV1 | undefined =
    input.projectId?.trim() &&
    input.targetRepository?.owner?.trim() &&
    input.targetRepository?.repo?.trim() &&
    recheckWorkBranch
      ? {
          projectId: input.projectId.trim(),
          codeTaskId: input.codeTask.codeTaskId,
          taskId: input.codeTask.parentTaskId.trim(),
          workBranch: recheckWorkBranch,
          baseBranch: recheckBaseBranch || input.targetRepository.defaultBranch || "main",
          repositoryOwner: input.targetRepository.owner.trim(),
          repositoryName: input.targetRepository.repo.trim(),
          repositoryFullName: input.targetRepository.repoFullName,
          targetRepository: input.targetRepository.repoFullName,
          githubCommitSha:
            unitOutcome?.commitSha ??
            input.runtimeSnapshotUnit?.latestCommitSha ??
            latestRun?.commitSha ??
            null,
          githubOutcomeSaved,
        }
      : undefined;

  return {
    codeTaskId: input.codeTask.codeTaskId,
    parentTaskId: input.codeTask.parentTaskId,
    title,
    metaLines,
    collapsedSummary,
    executionFlowSteps,
    isActive: input.isActive,
    isSelected: input.isSelected,
    isChecked: input.isChecked,
    boardState,
    checkboxDisabled,
    checkboxDisabledTitle,
    checkboxDisabledReason,
    ...(failureReason ? { failureReason } : {}),
    ...(showRetryFailedAction ? { showRetryFailedAction, retryFailedActionLabel } : {}),
    ...(githubVerifyView?.stateSyncFailed
      ? {
          failureReason:
            "GitHub commit은 확인했지만 플랫폼 실행 상태 반영에 실패했습니다. 상태 재확인을 다시 시도해 주세요.",
        }
      : {}),
    ...(phase === "prompt_preflight_failed"
      ? {
          nextActionHint:
            "프롬프트를 수정하거나 개발 프롬프트를 다시 생성한 뒤 실행해 주세요.",
        }
      : input.runtimeSnapshotUnit?.displayStatus === "failed"
        ? {
            nextActionHint:
              input.runtimeSnapshotUnit.userSafeFailureNextActionLine?.trim() ||
              "실패 작업을 다시 실행해 주세요.",
          }
        : phase === "failed"
      ? { nextActionHint: "실패 작업을 다시 실행해 주세요." }
      : {
            nextActionHint:
              "다음 처리: AI 개발자 실행 → GitHub 결과 확인",
          }),
    ...(githubRecheckPayload ? { githubRecheckPayload } : {}),
    isSampleDataCodeTask: isSampleDataCodeTaskRef({
      codeTaskId: input.codeTask.codeTaskId,
      parentTaskId: input.codeTask.parentTaskId,
      title: input.codeTask.title,
      changeType: input.codeTask.changeType,
    }),
  };
}

function groupCodeTasksByParent(
  plan: ImplementationCodeTaskPlanV1 | null | undefined,
): ReadonlyMap<string, readonly ImplementationCodeTaskV1[]> {
  const map = new Map<string, ImplementationCodeTaskV1[]>();
  for (const task of plan?.tasks ?? []) {
    const parentId = task.parentTaskId.trim();
    if (!parentId) continue;
    const list = map.get(parentId) ?? [];
    list.push(task);
    map.set(parentId, list);
  }
  return map;
}

function findWorkItemForCodeTask(
  workItems: readonly CursorWorkItem[] | undefined,
  codeTaskId: string,
): CursorWorkItem | null {
  if (!workItems?.length) return null;
  return (
    workItems.find((wi) => wi.codeTaskId === codeTaskId || wi.taskId === codeTaskId) ?? null
  );
}

/** CodeTask만 동일 레벨 평면 목록 (Process Task 그룹/접기 없음). */
export function buildImplementationFlatCodeTaskTreeNodes(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly codeTaskExecutionRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly activeCodeTaskId?: string | null;
  readonly selectedCodeTaskId?: string | null;
  readonly checkedCodeTaskIds?: readonly string[] | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
  readonly dbRuntimeRuns?: readonly ImplementationRuntimeRunView[] | null;
  readonly dbCurrentRun?: ImplementationRuntimeRunView | null;
  readonly implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
  readonly sequentialQuickRunCodeTaskIds?: readonly string[] | null;
  readonly promptTimeline?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[] | null;
  readonly executionUnits?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runtimeSnapshotUnits?: readonly import("@/lib/prototype/implementationRuntimeSnapshot").ImplementationRuntimeSnapshotV1["units"] | null;
  readonly projectId?: string | null;
  readonly targetRepository?: ProjectTargetRepository | null;
}): readonly ImplementationCodeTaskTreeNode[] {
  const plan =
    ensureCodeTaskPlanWithFileBoundaries({
      plan: input.codeTaskPlan ?? null,
      taskList: null,
    }) ?? input.codeTaskPlan;
  if (!plan?.tasks.length) return [];

  const rowByParentId = new Map(
    input.board.taskRows.map((row) => [row.taskId.trim(), row] as const),
  );
  const checkedCodeTaskIds = new Set(
    input.checkedCodeTaskIds != null
      ? input.checkedCodeTaskIds.map((id) => id.trim()).filter(Boolean)
      : normalizeSelectedCodeTaskIds({
          selectedCodeTaskIds: input.checkedCodeTaskIds,
          codeTaskPlan: plan,
        }),
  );
  const activeCodeTaskId = input.activeCodeTaskId?.trim() || null;
  const selectedCodeTaskId = input.selectedCodeTaskId?.trim() || null;
  const taskCursorExecution = input.taskCursorExecution ?? null;
  const unitByCodeTaskId = new Map(
    (input.executionUnits ?? []).map((u) => [u.codeTaskId, u] as const),
  );
  const snapshotByCodeTaskId = new Map(
    (input.runtimeSnapshotUnits ?? []).map((u) => [u.codeTaskId, u] as const),
  );

  const nodes: ImplementationCodeTaskTreeNode[] = [];
  for (const codeTask of plan.tasks) {
    const parentTaskId = codeTask.parentTaskId.trim();
    const row = rowByParentId.get(parentTaskId);
    if (!row) continue;

    const isSelected = selectedCodeTaskId === codeTask.codeTaskId;
    const isActive = activeCodeTaskId === codeTask.codeTaskId;

    nodes.push(
      buildCodeTaskNode({
        codeTask,
        row,
        workItem: findWorkItemForCodeTask(input.cursorWorkItems ?? undefined, codeTask.codeTaskId),
        taskCursorExecution,
        taskCursorExecutionHistory: input.taskCursorExecutionHistory,
        dbRuntimeRuns: input.dbRuntimeRuns,
        dbCurrentRun: input.dbCurrentRun,
        autoGate: input.implementationAutoQualityGateV1,
        codeTaskPlan: plan,
        codeTaskExecutionRuns: input.codeTaskExecutionRuns,
        isActive,
        isSelected,
        isChecked: checkedCodeTaskIds.has(codeTask.codeTaskId),
        sequentialQuickRunCodeTaskIds: input.sequentialQuickRunCodeTaskIds,
        promptTimeline: input.promptTimeline,
        executionUnit: unitByCodeTaskId.get(codeTask.codeTaskId) ?? null,
        runtimeSnapshotUnit: snapshotByCodeTaskId.get(codeTask.codeTaskId) ?? null,
        projectId: input.projectId,
        targetRepository: input.targetRepository,
      }),
    );
  }
  return nodes;
}

export function buildImplementationProcessTaskTreeNodes(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly codeTaskExecutionRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly activeTaskId?: string | null;
  readonly selectedTaskId?: string | null;
  readonly selectedCodeTaskId?: string | null;
  readonly checkedTaskIds?: readonly string[] | null;
  readonly checkedCodeTaskIds?: readonly string[] | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
  readonly dbRuntimeRuns?: readonly ImplementationRuntimeRunView[] | null;
  readonly dbCurrentRun?: ImplementationRuntimeRunView | null;
  readonly implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
}): readonly ImplementationProcessTaskTreeNode[] {
  const activeTaskId = input.activeTaskId?.trim() || null;
  const selectedTaskId = input.selectedTaskId?.trim() || activeTaskId;
  const selectedCodeTaskId = input.selectedCodeTaskId?.trim() || null;
  const taskCursorExecution = input.taskCursorExecution ?? null;
  const codeTasksByParent = groupCodeTasksByParent(input.codeTaskPlan);
  const orderedRows = orderTaskRowsForTreeDisplay(input.board.taskRows);
  const dependencyViews = computeTaskTreeDependencyViews(input.board.taskRows);
  const checkedCodeTaskIds = new Set(
    normalizeSelectedCodeTaskIds({
      selectedCodeTaskIds: input.checkedCodeTaskIds ?? input.checkedTaskIds,
      codeTaskPlan: input.codeTaskPlan,
    }),
  );

  return orderedRows.map((row) => {
    const dependencyView = dependencyViews.get(row.taskId);
    const isActive = activeTaskId === row.taskId;
    const isSelected = selectedTaskId === row.taskId;
    const codeTasksForParent = codeTasksByParent.get(row.taskId) ?? [];
    const codeTaskRowViews = codeTasksForParent.map((codeTask) =>
      buildCodeTaskRowView({
        codeTask,
        runs: input.codeTaskExecutionRuns,
        codeTaskPlan: input.codeTaskPlan,
      }),
    );
    const isChecked =
      codeTasksForParent.length > 0
        ? isProcessTaskCodeTasksFullySelected({
            parentTaskId: row.taskId,
            selectedCodeTaskIds: [...checkedCodeTaskIds],
            codeTaskPlan: input.codeTaskPlan,
          })
        : false;
    const codeTasks: ImplementationCodeTaskTreeNode[] = codeTasksForParent.map((codeTask) =>
      buildCodeTaskNode({
        codeTask,
        row,
        workItem: findWorkItemForCodeTask(input.cursorWorkItems ?? undefined, codeTask.codeTaskId),
        taskCursorExecution,
        taskCursorExecutionHistory: input.taskCursorExecutionHistory,
        dbRuntimeRuns: input.dbRuntimeRuns,
        dbCurrentRun: input.dbCurrentRun,
        autoGate: input.implementationAutoQualityGateV1,
        codeTaskPlan: input.codeTaskPlan,
        codeTaskExecutionRuns: input.codeTaskExecutionRuns,
        isActive: isActive && (selectedCodeTaskId === codeTask.codeTaskId || (!selectedCodeTaskId && codeTasksForParent[0]?.codeTaskId === codeTask.codeTaskId)),
        isSelected: selectedCodeTaskId === codeTask.codeTaskId,
        isChecked: checkedCodeTaskIds.has(codeTask.codeTaskId),
      }),
    );

    const collapsedSummary =
      codeTaskRowViews.length > 0
        ? summarizeCodeTaskRowViewsForProcess(codeTaskRowViews)
        : isPerTaskPipelineComplete(row)
          ? "완료"
          : row.developerStatus === "done"
            ? "개발 완료"
            : row.developerStatus === "in_progress" || isActive
              ? "Cursor 실행 중"
              : row.developerStatus === "failed"
                ? "재작업 필요"
                : "개발 대기";

    return {
      taskId: row.taskId,
      title: stripLeadingTaskIdFromTitle(row.taskId, row.title),
      metaLines: buildProcessMetaLines(row),
      collapsedSummary,
      isActive,
      isSelected,
      isChecked,
      treeDepth: dependencyView?.depth ?? 0,
      defaultExpanded: isActive || isSelected || codeTasks.some((ct) => ct.isSelected),
      codeTasks,
      canRestart: false,
      needsReworkRegistration: false,
    };
  });
}
