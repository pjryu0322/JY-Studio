import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import {
  evaluateCursorExecutionAvailability,
  formatCursorExecutionAvailabilityDiagnosticLines,
  type CursorExecutionAvailability,
} from "@/lib/prototype/cursorExecutionAvailability";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  pickFirstExecutableDeveloperTaskId,
  type ImplementationBoardStepStatus,
  type ImplementationExecutionBoardTaskRowV1,
  type ImplementationExecutionBoardV1,
  type ImplementationUserConfirmationStatus,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  deriveImplementationUserTestReadiness,
  type ImplementationUserTestReadiness,
} from "@/lib/prototype/implementationUserTestReadiness";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ImplementationStageNextAction } from "@/lib/prototype/implementationStageNextActions";

const IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE = "IMPLEMENTATION_TASK_LIST_READY_V1" as const;

export type ImplementationRequirementsBoardOrchestrationSlice = Readonly<{
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
  readonly implementationTaskExecutionStateV1?: ImplementationTaskExecutionStateV1 | null;
  readonly cursorWorkItemsV1?: readonly unknown[] | null;
}>;

export function hasImplementationExecutionBoardOrchestrationData(
  orchestration: ImplementationRequirementsBoardOrchestrationSlice,
): boolean {
  if (orchestration.implementationTaskListV1?.tasks?.length) return true;
  if (orchestration.cursorWorkItemsV1?.length) return true;
  if (orchestration.implementationTaskExecutionStateV1?.items?.length) return true;
  return false;
}

export function resolveImplementationExecutionBoardSelectedTaskId(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
}): string | null {
  const fromBoard = input.board.currentTaskId?.trim();
  if (fromBoard) return fromBoard;
  const fromWip = input.codeAgentWipExecutionV1?.selectedTaskId?.trim();
  if (fromWip) return fromWip;
  return pickFirstExecutableDeveloperTaskId(input.board) ?? input.board.taskRows[0]?.taskId ?? null;
}

export function formatImplementationBoardStepStatusKo(status: ImplementationBoardStepStatus): string {
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

export function formatImplementationBoardUserConfirmationKo(
  status: ImplementationUserConfirmationStatus,
): string {
  switch (status) {
    case "none":
      return "-";
    case "optional":
      return "선택";
    case "required_non_blocking":
      return "권장";
    case "blocking":
      return "차단";
    default:
      return status;
  }
}

export function formatImplementationBoardRoleKo(
  role: ImplementationExecutionBoardTaskRowV1["currentRole"],
): string {
  switch (role) {
    case "developer":
      return "개발";
    case "reviewer":
      return "검수";
    case "security":
      return "보안";
    case "scm":
      return "SCM";
    case "completed":
      return "완료";
    default:
      return role;
  }
}

export type ImplementationExecutionBoardRowWipOverlay = Readonly<{
  readonly branchName?: string;
  readonly commitMessage?: string;
  readonly commitSha?: string;
  readonly changedFileCount?: number;
  readonly testResultCount?: number;
}>;

export function buildImplementationExecutionBoardRowWipOverlay(input: {
  readonly row: ImplementationExecutionBoardTaskRowV1;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
}): ImplementationExecutionBoardRowWipOverlay | null {
  const wip = input.codeAgentWipExecutionV1;
  if (!wip) return null;
  const selectedTaskId = wip.selectedTaskId?.trim();
  if (selectedTaskId && selectedTaskId !== input.row.taskId) return null;
  const latestCommit = wip.commits[wip.commits.length - 1];
  return {
    branchName: wip.branchName || latestCommit?.branchName,
    commitMessage: latestCommit?.commitMessage,
    commitSha: latestCommit?.sha,
    changedFileCount: latestCommit?.changedFiles.length,
    testResultCount: latestCommit?.testResults.length,
  };
}

export type ImplementationExecutionBoardSummaryView = Readonly<{
  readonly cursorAvailability: CursorExecutionAvailability;
  readonly cursorAvailabilityLabel: string;
  readonly envPills: readonly { readonly label: string; readonly value: string; readonly tone: "ok" | "warn" | "muted" }[];
  readonly envDiagnosticLines: readonly string[];
  readonly testReadiness: ImplementationUserTestReadiness;
  readonly previewReady: boolean;
}>;

export function buildImplementationExecutionBoardSummaryView(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly executionSetup?: ExecutionSetupSourceGenerationRow | null;
  readonly previewReady?: boolean;
  readonly hasExecutionState?: boolean;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
}): ImplementationExecutionBoardSummaryView {
  const cursorAvailability = evaluateCursorExecutionAvailability({ setup: input.executionSetup });
  const testReadiness = deriveImplementationUserTestReadiness({
    board: input.board,
    previewReady: input.previewReady === true,
    hasTaskList: true,
    hasExecutionState: input.hasExecutionState !== false,
    boardState: input.boardState,
  });

  const envPills = [
    {
      label: "Cursor",
      value: cursorAvailability.status,
      tone: cursorAvailability.ready ? ("ok" as const) : ("warn" as const),
    },
    {
      label: "GitHub",
      value: cursorAvailability.hasGithubToken ? "설정됨" : "미설정",
      tone: cursorAvailability.hasGithubToken ? ("ok" as const) : ("warn" as const),
    },
    {
      label: "Workspace",
      value: cursorAvailability.hasWorkspace ? "설정됨" : "미설정",
      tone: cursorAvailability.hasWorkspace ? ("ok" as const) : ("warn" as const),
    },
    {
      label: "Push",
      value: input.executionSetup?.autoPush === true ? "on" : "off",
      tone: input.executionSetup?.autoPush === true ? ("ok" as const) : ("muted" as const),
    },
  ] as const;

  return {
    cursorAvailability,
    cursorAvailabilityLabel: cursorAvailability.status,
    envPills,
    envDiagnosticLines: formatCursorExecutionAvailabilityDiagnosticLines({
      setup: input.executionSetup,
    }),
    testReadiness,
    previewReady: input.previewReady === true,
  };
}

export function isLongImplementationBoardChatMessage(content: string): boolean {
  return (
    content.includes("TASK ID | 작업 | 개발자 | 검수자 | 보안관 | SCM") ||
    content.includes("작업 목록:") ||
    content.includes("통합 정리 단계:")
  );
}

export function collapseImplementationBoardChatMessagesForPanelView(
  messages: readonly RequirementsMessage[],
  boardPanelActive: boolean,
): readonly RequirementsMessage[] {
  if (!boardPanelActive) return messages;
  return messages.flatMap((message) => {
    if (message.meta.internalType !== IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE) {
      return [message];
    }
    if (!isLongImplementationBoardChatMessage(message.content)) {
      return [message];
    }
    return [];
  });
}

export function dedupeImplementationStageNextActions(
  actions: readonly ImplementationStageNextAction[],
): readonly ImplementationStageNextAction[] {
  const seen = new Set<string>();
  const out: ImplementationStageNextAction[] = [];
  for (const action of actions) {
    const key = `${action.actionId}::${action.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}
