import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";
import {
  appendImplementationQualityGateResult,
  executeImplementationQualityGateCheck,
  type ImplementationQualityGateResultV1,
} from "@/lib/prototype/implementationQualityGate";
import {
  markRoleTasksDone,
  type ImplementationTaskExecutionStateV1,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  pickQualityGateTargetTaskIds,
  type ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import {
  patchTaskCursorExecution,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import {
  shouldSyncExecutionStateAfterTaskCursorGithubVerify,
  syncTaskExecutionStateAfterGithubVerified,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";

export const IMPLEMENTATION_AUTO_QUALITY_GATE_VERSION = "implementation_auto_quality_gate_v1" as const;

export type ImplementationAutoQualityGateStatus =
  | "idle"
  | "review_running"
  | "review_passed"
  | "review_failed"
  | "security_running"
  | "security_passed"
  | "security_failed"
  | "passed"
  | "failed";

export type ImplementationAutoQualityGateTimelineAction =
  | "implementation_auto_quality_gate_requested"
  | "implementation_auto_review_started"
  | "implementation_auto_review_passed"
  | "implementation_auto_review_failed"
  | "implementation_auto_security_started"
  | "implementation_auto_security_passed"
  | "implementation_auto_security_failed"
  | "implementation_auto_quality_gate_passed"
  | "implementation_auto_quality_gate_failed";

export type ImplementationAutoQualityGateV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_AUTO_QUALITY_GATE_VERSION;
  readonly projectId: string;
  readonly taskId: string;
  readonly sourceCommitSha: string;
  readonly changedFiles: readonly string[];
  readonly status: ImplementationAutoQualityGateStatus;
  readonly reviewResultId?: string;
  readonly securityResultId?: string;
  readonly failureReason?: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}>;

export function parseImplementationAutoQualityGateV1(raw: unknown): ImplementationAutoQualityGateV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_AUTO_QUALITY_GATE_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const taskId = String(o.taskId ?? "").trim();
  const sourceCommitSha = String(o.sourceCommitSha ?? "").trim();
  const status = String(o.status ?? "").trim() as ImplementationAutoQualityGateStatus;
  if (!projectId || !taskId || !sourceCommitSha) return null;
  const changedFiles = Array.isArray(o.changedFiles)
    ? o.changedFiles.map((f) => String(f).trim()).filter(Boolean)
    : [];
  return {
    version: IMPLEMENTATION_AUTO_QUALITY_GATE_VERSION,
    projectId,
    taskId,
    sourceCommitSha,
    changedFiles,
    status,
    reviewResultId: o.reviewResultId === undefined ? undefined : String(o.reviewResultId).trim() || undefined,
    securityResultId:
      o.securityResultId === undefined ? undefined : String(o.securityResultId).trim() || undefined,
    failureReason: o.failureReason === undefined ? undefined : String(o.failureReason),
    startedAt: String(o.startedAt ?? new Date().toISOString()),
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
    completedAt: o.completedAt === undefined ? undefined : String(o.completedAt),
  };
}

export function parseImplementationAutoQualityGateHistoryV1(
  raw: unknown,
): readonly ImplementationAutoQualityGateV1[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  return raw
    .map((entry) => parseImplementationAutoQualityGateV1(entry))
    .filter((entry): entry is ImplementationAutoQualityGateV1 => entry != null);
}

export function patchImplementationAutoQualityGate(
  current: ImplementationAutoQualityGateV1,
  patch: Partial<Omit<ImplementationAutoQualityGateV1, "version" | "projectId" | "taskId" | "startedAt">> & {
    readonly nowIso?: string;
  },
): ImplementationAutoQualityGateV1 {
  const now = patch.nowIso ?? new Date().toISOString();
  const { nowIso: _nowIso, ...rest } = patch;
  return {
    ...current,
    ...rest,
    ...(patch.changedFiles ? { changedFiles: [...patch.changedFiles] } : {}),
    updatedAt: now,
  };
}

export function buildInitialImplementationAutoQualityGate(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly sourceCommitSha: string;
  readonly changedFiles?: readonly string[];
  readonly nowIso?: string;
}): ImplementationAutoQualityGateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    version: IMPLEMENTATION_AUTO_QUALITY_GATE_VERSION,
    projectId: input.projectId,
    taskId: input.taskId,
    sourceCommitSha: input.sourceCommitSha,
    changedFiles: [...(input.changedFiles ?? [])],
    status: "review_running",
    startedAt: now,
    updatedAt: now,
  };
}

export function appendImplementationAutoQualityGateHistory(
  history: readonly ImplementationAutoQualityGateV1[] | null | undefined,
  entry: ImplementationAutoQualityGateV1,
): readonly ImplementationAutoQualityGateV1[] {
  const base = history ? [...history] : [];
  base.push(entry);
  return base.slice(-30);
}

function appendImplementationAutoQualityGateTimelineEntries(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entries: readonly RequirementsPromptTimelineEntry[],
): RequirementsPromptTimelineEntry[] {
  return entries.reduce(
    (acc, entry) => appendPromptTimeline(acc, entry),
    [...(existing ?? [])],
  );
}

export function buildImplementationAutoQualityGateTimelineEntry(input: {
  readonly action: ImplementationAutoQualityGateTimelineAction;
  readonly projectId: string;
  readonly taskId: string;
  readonly sourceCommitSha?: string;
  readonly changedFileCount?: number;
  readonly reviewResult?: string;
  readonly securityResult?: string;
  readonly status?: string;
  readonly reason?: string;
  readonly runId?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const fields = [
    `type=${input.action}`,
    `projectId=${input.projectId}`,
    `taskId=${input.taskId}`,
    ...(input.sourceCommitSha ? [`sourceCommitSha=${input.sourceCommitSha.slice(0, 12)}`] : []),
    ...(input.changedFileCount != null ? [`changedFileCount=${input.changedFileCount}`] : []),
    ...(input.reviewResult ? [`reviewResult=${input.reviewResult}`] : []),
    ...(input.securityResult ? [`securityResult=${input.securityResult}`] : []),
    ...(input.status ? [`status=${input.status}`] : []),
    ...(input.reason ? [`reason=${input.reason}`] : []),
    ...(input.runId ? [`runId=${input.runId}`] : []),
  ];
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    responseText: fields.join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function shouldAutoStartImplementationQualityGate(input: {
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
}): boolean {
  const execution = input.taskCursorExecution;
  if (!execution) return false;
  if (!shouldSyncExecutionStateAfterTaskCursorGithubVerify(execution.status)) return false;
  const commitSha = String(execution.commitSha ?? "").trim();
  if (!commitSha || commitSha.startsWith("wip-stub")) return false;

  const gate = input.autoGate;
  if (
    gate &&
    gate.taskId === execution.taskId &&
    gate.sourceCommitSha === commitSha &&
    (gate.status === "passed" ||
      gate.status === "review_running" ||
      gate.status === "security_running" ||
      gate.status === "review_passed")
  ) {
    return false;
  }
  if (
    gate &&
    gate.taskId === execution.taskId &&
    gate.sourceCommitSha === commitSha &&
    gate.status === "failed"
  ) {
    return false;
  }
  return true;
}

export function shouldResumeImplementationAutoQualityGate(input: {
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
}): boolean {
  const execution = input.taskCursorExecution;
  const gate = input.autoGate;
  if (!execution || !gate) return false;
  if (gate.taskId !== execution.taskId) return false;
  const commitSha = String(execution.commitSha ?? "").trim();
  if (!commitSha || gate.sourceCommitSha !== commitSha) return false;
  return isImplementationAutoQualityGateInFlight(gate);
}

export function isImplementationAutoQualityGateInFlight(
  gate: ImplementationAutoQualityGateV1 | null | undefined,
): boolean {
  if (!gate) return false;
  return gate.status === "review_running" || gate.status === "security_running";
}

export type ImplementationAutoQualityGateRunOutcome = Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly autoGate: ImplementationAutoQualityGateV1;
}>;

export function runImplementationAutoQualityGate(input: {
  readonly projectId: string;
  readonly taskCursorExecution: TaskCursorExecutionV1;
  readonly taskList: ImplementationTaskListV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[];
  readonly board?: ImplementationExecutionBoardV1 | null;
  readonly existingTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly existingAutoQualityGateHistory?: readonly ImplementationAutoQualityGateV1[] | null;
  readonly nowIso?: string;
}): ImplementationAutoQualityGateRunOutcome | Readonly<{ readonly blocked: string }> {
  const execution = input.taskCursorExecution;
  const commitSha = String(execution.commitSha ?? "").trim();
  if (!commitSha || commitSha.startsWith("wip-stub")) {
    return { blocked: "GitHub commit SHA가 없어 자동 품질 게이트를 실행할 수 없습니다." };
  }
  if (!shouldSyncExecutionStateAfterTaskCursorGithubVerify(execution.status)) {
    return { blocked: "GitHub commit 확인 후에만 자동 품질 게이트를 실행할 수 있습니다." };
  }

  const now = input.nowIso ?? new Date().toISOString();
  const timeline: RequirementsPromptTimelineEntry[] = [
    buildImplementationAutoQualityGateTimelineEntry({
      action: "implementation_auto_quality_gate_requested",
      projectId: input.projectId,
      taskId: execution.taskId,
      sourceCommitSha: commitSha,
      changedFileCount: execution.changedFiles?.length ?? 0,
      runId: execution.cursorRunId,
      nowIso: now,
    }),
    buildImplementationAutoQualityGateTimelineEntry({
      action: "implementation_auto_review_started",
      projectId: input.projectId,
      taskId: execution.taskId,
      sourceCommitSha: commitSha,
      status: "review_running",
      runId: execution.cursorRunId,
      nowIso: now,
    }),
  ];

  let autoGate = buildInitialImplementationAutoQualityGate({
    projectId: input.projectId,
    taskId: execution.taskId,
    sourceCommitSha: commitSha,
    changedFiles: execution.changedFiles,
    nowIso: now,
  });

  let executionState =
    input.executionState &&
    syncTaskExecutionStateAfterGithubVerified({
      executionState: input.executionState,
      taskId: execution.taskId,
      cursorWorkItems: input.cursorWorkItems ?? [],
      nowIso: now,
    });

  const targetTaskIds =
    input.board != null
      ? pickQualityGateTargetTaskIds({
          role: "reviewer",
          board: input.board,
          taskCursorTaskId: execution.taskId,
        })
      : [execution.taskId];
  const scopedTargetTaskIds = targetTaskIds.length ? targetTaskIds : [execution.taskId];

  const reviewOutcome = executeImplementationQualityGateCheck({
    role: "reviewer",
    taskList: input.taskList,
    executionState,
    qualityGateResults: input.qualityGateResults,
    projectId: input.projectId,
    targetTaskIds: scopedTargetTaskIds,
    nowIso: now,
  });
  if ("blocked" in reviewOutcome) {
    return { blocked: reviewOutcome.blocked };
  }

  let qualityGateResults = reviewOutcome.qualityGateResults;
  executionState = reviewOutcome.executionState;
  const reviewResultId = `${execution.taskId}-review-${now}`;

  if (!reviewOutcome.passed) {
    autoGate = patchImplementationAutoQualityGate(autoGate, {
      status: "failed",
      reviewResultId,
      failureReason: reviewOutcome.qualityGateResult.summary,
      completedAt: now,
      nowIso: now,
    });
    timeline.push(
      buildImplementationAutoQualityGateTimelineEntry({
        action: "implementation_auto_review_failed",
        projectId: input.projectId,
        taskId: execution.taskId,
        sourceCommitSha: commitSha,
        reviewResult: reviewOutcome.qualityGateResult.status,
        status: "failed",
        reason: reviewOutcome.qualityGateResult.summary,
        runId: execution.cursorRunId,
        nowIso: now,
      }),
      buildImplementationAutoQualityGateTimelineEntry({
        action: "implementation_auto_quality_gate_failed",
        projectId: input.projectId,
        taskId: execution.taskId,
        sourceCommitSha: commitSha,
        status: "failed",
        reason: reviewOutcome.qualityGateResult.summary,
        runId: execution.cursorRunId,
        nowIso: now,
      }),
    );
    const taskCursorExecution = patchTaskCursorExecution(execution, {
      status: "review_pending",
      errorMessage: reviewOutcome.qualityGateResult.summary,
      nowIso: now,
    });
    return {
      ok: false,
      message: reviewOutcome.aiMessageContent,
      autoGate,
      orchestrationPatch: {
        implementationAutoQualityGateV1: autoGate,
        implementationAutoQualityGateHistoryV1: appendImplementationAutoQualityGateHistory(
          input.existingAutoQualityGateHistory,
          autoGate,
        ),
        taskCursorExecutionV1: taskCursorExecution,
        implementationTaskExecutionStateV1: executionState,
        implementationQualityGateResultsV1: qualityGateResults,
        promptTimeline: appendImplementationAutoQualityGateTimelineEntries(input.existingTimeline, timeline),
      },
    };
  }

  autoGate = patchImplementationAutoQualityGate(autoGate, {
    status: "security_running",
    reviewResultId,
    nowIso: now,
  });
  timeline.push(
    buildImplementationAutoQualityGateTimelineEntry({
      action: "implementation_auto_review_passed",
      projectId: input.projectId,
      taskId: execution.taskId,
      sourceCommitSha: commitSha,
      reviewResult: "passed",
      status: "security_running",
      runId: execution.cursorRunId,
      nowIso: now,
    }),
    buildImplementationAutoQualityGateTimelineEntry({
      action: "implementation_auto_security_started",
      projectId: input.projectId,
      taskId: execution.taskId,
      sourceCommitSha: commitSha,
      status: "security_running",
      runId: execution.cursorRunId,
      nowIso: now,
    }),
  );

  const securityOutcome = executeImplementationQualityGateCheck({
    role: "security",
    taskList: input.taskList,
    executionState,
    qualityGateResults,
    projectId: input.projectId,
    targetTaskIds: scopedTargetTaskIds,
    nowIso: now,
  });
  if ("blocked" in securityOutcome) {
    return { blocked: securityOutcome.blocked };
  }

  qualityGateResults = securityOutcome.qualityGateResults;
  executionState = securityOutcome.executionState;
  const securityResultId = `${execution.taskId}-security-${now}`;

  if (!securityOutcome.passed) {
    autoGate = patchImplementationAutoQualityGate(autoGate, {
      status: "failed",
      securityResultId,
      failureReason: securityOutcome.qualityGateResult.summary,
      completedAt: now,
      nowIso: now,
    });
    timeline.push(
      buildImplementationAutoQualityGateTimelineEntry({
        action: "implementation_auto_security_failed",
        projectId: input.projectId,
        taskId: execution.taskId,
        sourceCommitSha: commitSha,
        securityResult: securityOutcome.qualityGateResult.status,
        status: "failed",
        reason: securityOutcome.qualityGateResult.summary,
        runId: execution.cursorRunId,
        nowIso: now,
      }),
      buildImplementationAutoQualityGateTimelineEntry({
        action: "implementation_auto_quality_gate_failed",
        projectId: input.projectId,
        taskId: execution.taskId,
        sourceCommitSha: commitSha,
        status: "failed",
        reason: securityOutcome.qualityGateResult.summary,
        runId: execution.cursorRunId,
        nowIso: now,
      }),
    );
    const taskCursorExecution = patchTaskCursorExecution(execution, {
      status: "review_pending",
      errorMessage: securityOutcome.qualityGateResult.summary,
      nowIso: now,
    });
    return {
      ok: false,
      message: securityOutcome.aiMessageContent,
      autoGate,
      orchestrationPatch: {
        implementationAutoQualityGateV1: autoGate,
        implementationAutoQualityGateHistoryV1: appendImplementationAutoQualityGateHistory(
          input.existingAutoQualityGateHistory,
          autoGate,
        ),
        taskCursorExecutionV1: taskCursorExecution,
        implementationTaskExecutionStateV1: executionState,
        implementationQualityGateResultsV1: qualityGateResults,
        promptTimeline: appendImplementationAutoQualityGateTimelineEntries(input.existingTimeline, timeline),
      },
    };
  }

  if (executionState) {
    executionState = markRoleTasksDone({
      state: executionState,
      ownerRole: "reviewer",
      nowIso: now,
      resultSummary: reviewOutcome.qualityGateResult.summary,
    });
    executionState = markRoleTasksDone({
      state: executionState,
      ownerRole: "security",
      nowIso: now,
      resultSummary: securityOutcome.qualityGateResult.summary,
    });
  }

  autoGate = patchImplementationAutoQualityGate(autoGate, {
    status: "passed",
    securityResultId,
    completedAt: now,
    nowIso: now,
  });
  timeline.push(
    buildImplementationAutoQualityGateTimelineEntry({
      action: "implementation_auto_security_passed",
      projectId: input.projectId,
      taskId: execution.taskId,
      sourceCommitSha: commitSha,
      securityResult: "passed",
      status: "passed",
      runId: execution.cursorRunId,
      nowIso: now,
    }),
    buildImplementationAutoQualityGateTimelineEntry({
      action: "implementation_auto_quality_gate_passed",
      projectId: input.projectId,
      taskId: execution.taskId,
      sourceCommitSha: commitSha,
      reviewResult: "passed",
      securityResult: "passed",
      status: "passed",
      runId: execution.cursorRunId,
      nowIso: now,
    }),
  );

  const taskCursorExecution = patchTaskCursorExecution(execution, {
    status: "scm_pending",
    errorMessage: undefined,
    failureReason: undefined,
    nowIso: now,
  });

  return {
    ok: true,
    message: [
      "검수자·보안관 자동 점검이 완료되었습니다.",
      "우선순위 기준 다음 작업을 자동으로 시작합니다.",
    ].join("\n"),
    autoGate,
    orchestrationPatch: {
      implementationAutoQualityGateV1: autoGate,
      implementationAutoQualityGateHistoryV1: appendImplementationAutoQualityGateHistory(
        input.existingAutoQualityGateHistory,
        autoGate,
      ),
      taskCursorExecutionV1: taskCursorExecution,
      implementationTaskExecutionStateV1: executionState,
      implementationQualityGateResultsV1: qualityGateResults,
      promptTimeline: appendImplementationAutoQualityGateTimelineEntries(input.existingTimeline, timeline),
    },
  };
}

export function summarizeImplementationAutoQualityGateForProgress(
  gate: ImplementationAutoQualityGateV1 | null | undefined,
): Readonly<{ readonly statusLabel: string; readonly summaryLine: string }> | null {
  if (!gate) return null;
  switch (gate.status) {
    case "review_running":
      return {
        statusLabel: "자동 검수 중",
        summaryLine: "검수자 점검을 자동으로 진행합니다.",
      };
    case "security_running":
    case "review_passed":
      return {
        statusLabel: "자동 보안 점검 중",
        summaryLine: "보안관 점검을 자동으로 진행합니다.",
      };
    case "passed":
      return {
        statusLabel: "품질 게이트 통과",
        summaryLine: "검수자·보안관 점검이 완료되었습니다.",
      };
    case "failed":
      return {
        statusLabel: "재작업 필요",
        summaryLine:
          gate.failureReason ??
          "검수자 또는 보안관 점검에서 수정 필요 항목이 발견되었습니다.",
      };
    default:
      return null;
  }
}
