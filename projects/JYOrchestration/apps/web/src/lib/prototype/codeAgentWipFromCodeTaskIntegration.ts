import type { CodeAgentWipCommit, CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import {
  CODE_AGENT_WIP_EXECUTION_VERSION,
  isRealCursorSourceGenerationCompleted,
} from "@/lib/prototype/codeAgentWipExecution";
import {
  buildProviderWipCommitMessage,
  DEFAULT_CODE_AGENT_PROVIDER,
} from "@/lib/prototype/codeAgentProvider";
import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  evaluateCodeTaskIntegration,
  type CodeTaskIntegrationSource,
} from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import { buildTaskCursorExecutionsForIntegration } from "@/lib/prototype/implementationIntegrationService";
import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import { buildInitialPlatformScmExecutionFromWip } from "@/lib/prototype/platformScmExecution";
import { validateFinalScmIntegratedStageReadiness } from "@/lib/prototype/platformScmReadiness";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export type ResolveCodeAgentWipForFinalScmResult =
  | Readonly<{
      readonly ok: true;
      readonly wip: CodeAgentWipExecutionV1;
      readonly synthesized: boolean;
    }>
  | Readonly<{ readonly ok: false; readonly message: string }>;

function pickPrimaryIntegrationScopeRow(
  previewScope: ImplementationPreviewScopeV1 | null | undefined,
  includedCount: number,
): ImplementationPreviewScopeV1["includedCodeTasks"][number] | null {
  const fromScope = previewScope?.includedCodeTasks ?? [];
  if (fromScope.length) return fromScope[fromScope.length - 1] ?? null;
  if (includedCount > 0) return null;
  return null;
}

function resolveTaskCursorForIntegrationTarget(input: {
  readonly taskId: string;
  readonly commitSha: string;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
}): TaskCursorExecutionV1 | null {
  const wantSha = input.commitSha.trim();
  const executions = buildTaskCursorExecutionsForIntegration({
    current: input.taskCursorExecution ?? null,
    history: input.taskCursorExecutionHistory ?? null,
  });
  const matched = executions.find(
    (row) =>
      row.taskId === input.taskId &&
      String(row.commitSha ?? row.branchHeadCommitSha ?? "").trim() === wantSha,
  );
  if (matched) return matched;
  return executions.find((row) => row.taskId === input.taskId) ?? null;
}

function buildCodeAgentWipFromCodeTaskIntegrationEvidence(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly codeTaskId: string;
  readonly commitSha: string;
  readonly workBranch: string;
  readonly execution: TaskCursorExecutionV1;
  readonly run: CodeTaskExecutionRunV1 | null;
  readonly repoFullName: string;
  readonly baseBranch: string;
  readonly nowIso: string;
}): CodeAgentWipExecutionV1 {
  const provider = DEFAULT_CODE_AGENT_PROVIDER;
  const changedFiles = [
    ...(Array.isArray(input.execution.changedFiles) ? input.execution.changedFiles : []),
    ...(Array.isArray(input.run?.changedFiles) ? input.run.changedFiles : []),
  ].filter((path, index, all) => path.trim() && all.indexOf(path) === index);
  const files =
    changedFiles.length > 0
      ? changedFiles
      : [`code-task/${input.codeTaskId.trim() || "integration"}`];

  const commit: CodeAgentWipCommit = {
    provider,
    sha: input.commitSha,
    branchName: input.workBranch,
    commitMessage: buildProviderWipCommitMessage(
      provider,
      `code task integration ${input.codeTaskId}`,
      false,
      input.taskId,
    ),
    taskId: input.taskId,
    workItemId: input.run?.workItemId?.trim() || input.execution.workItemIds?.[0] || "unknown",
    changedFiles: files,
    diffSummary: [],
    testResults: [],
    unresolvedIssues: ["Quick Run CodeTask 통합 — 플랫폼 SCM에서 push/PR을 수행합니다."],
    createdAt: input.nowIso,
    targetRepository: input.repoFullName,
  };

  const wipBase: CodeAgentWipExecutionV1 = {
    version: CODE_AGENT_WIP_EXECUTION_VERSION,
    projectId: input.projectId,
    provider,
    status: "developer_approved",
    branchName: input.workBranch,
    requestedAt: input.nowIso,
    requestedBy: "ai_developer",
    workItems: input.execution.workItemIds?.length
      ? [...input.execution.workItemIds]
      : [commit.workItemId],
    commits: [commit],
    refactorRequests: [],
    selectedTaskId: input.taskId,
    selectedWorkItemIds: input.execution.workItemIds?.length
      ? [...input.execution.workItemIds]
      : [commit.workItemId],
    executionMode: "cursor_api",
    bridgeAdapter: "cursor_api",
    bridgeExecutionStatus: "bridge_completed",
    executionStatus: "bridge_completed",
    bridgeCompletedAt: input.nowIso,
    commitSha: input.commitSha,
    targetRepository: input.repoFullName,
    targetRepoFullName: input.repoFullName,
    baseBranch: input.baseBranch,
    pushed: false,
    developerReview: {
      status: "approved",
      reviewedAt: input.nowIso,
      reviewedBy: "ai_developer",
      summary: "Quick Run CodeTask 완료·통합 단계 자동 승인",
      findings: [],
      requestedActions: [],
    },
  };

  const platformScmExecutionV1 = buildInitialPlatformScmExecutionFromWip({
    wip: wipBase,
    commitSha: input.commitSha,
    branchName: input.workBranch,
    nowIso: input.nowIso,
  });

  return { ...wipBase, platformScmExecutionV1 };
}

/** Quick Run(Task Cursor)만 완료된 경우 legacy WIP 없이 최종 SCM용 WIP 스냅샷을 만든다. */
export function resolveCodeAgentWipForFinalScmIntegratedStage(input: {
  readonly projectId: string;
  readonly existingWip?: CodeAgentWipExecutionV1 | null;
  readonly previewScope?: ImplementationPreviewScopeV1 | null;
  readonly executionSetup?: ExecutionSetupSourceGenerationRow | null;
  readonly nowIso?: string;
} & CodeTaskIntegrationSource): ResolveCodeAgentWipForFinalScmResult {
  const pid = input.projectId.trim();
  if (!pid) return { ok: false, message: "프로젝트를 선택해 주세요." };

  const existing = input.existingWip ?? null;
  if (existing && validateFinalScmIntegratedStageReadiness(existing).ok) {
    return { ok: true, wip: existing, synthesized: false };
  }

  const integration = evaluateCodeTaskIntegration({
    codeTaskPlan: input.codeTaskPlan ?? null,
    taskList: input.taskList ?? null,
    codeTaskRuns: input.codeTaskRuns ?? null,
    taskCursorExecution: input.taskCursorExecution ?? null,
    taskCursorExecutionHistory: input.taskCursorExecutionHistory ?? null,
    autoQualityGate: input.autoQualityGate ?? null,
  });
  if (!integration.canIntegrate || !integration.included.length) {
    return {
      ok: false,
      message:
        "완료된 CodeTask GitHub commit이 없어 최종 SCM 반영을 실행할 수 없습니다. CodeTask 실행을 먼저 완료해 주세요.",
    };
  }

  const scopeRow = pickPrimaryIntegrationScopeRow(
    input.previewScope,
    integration.included.length,
  );
  const primary =
    integration.included.find(
      (row) =>
        scopeRow &&
        row.codeTaskId === scopeRow.codeTaskId &&
        row.taskId === scopeRow.taskId,
    ) ?? integration.included[integration.included.length - 1];

  const commitSha = String(primary.commitSha ?? "").trim();
  const workBranch = String(primary.workBranch ?? "").trim();
  if (!commitSha || !workBranch) {
    return {
      ok: false,
      message:
        "완료된 CodeTask에 branch·commit 정보가 없어 최종 SCM 반영을 실행할 수 없습니다.",
    };
  }

  const execution = resolveTaskCursorForIntegrationTarget({
    taskId: primary.taskId,
    commitSha,
    taskCursorExecution: input.taskCursorExecution ?? null,
    taskCursorExecutionHistory: input.taskCursorExecutionHistory ?? null,
  });
  if (!execution) {
    return {
      ok: false,
      message:
        "Task Cursor 실행 기록을 찾지 못해 최종 SCM 반영을 실행할 수 없습니다. 구현 탭을 연 상태로 잠시 후 다시 시도해 주세요.",
    };
  }

  const targetRepo =
    resolveProjectTargetRepositoryFromExecutionSetup({
      gitRepoName: input.executionSetup?.gitRepoName,
      gitRepoUrl: input.executionSetup?.gitRepoUrl,
      baseBranch: input.executionSetup?.baseBranch,
    }) ??
    (execution.targetRepository?.trim()
      ? {
          repoFullName: execution.targetRepository.trim(),
          defaultBranch: execution.baseBranch?.trim() || "main",
        }
      : null);
  if (!targetRepo?.repoFullName) {
    return {
      ok: false,
      message: "대상 Git 저장소가 설정되지 않아 최종 SCM 반영을 실행할 수 없습니다.",
    };
  }

  const baseBranch = String(
    execution.baseBranch ?? input.executionSetup?.baseBranch ?? targetRepo.defaultBranch ?? "main",
  ).trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const run = findLatestRunForCodeTask(input.codeTaskRuns ?? [], primary.codeTaskId);

  const wip = buildCodeAgentWipFromCodeTaskIntegrationEvidence({
    projectId: pid,
    taskId: primary.taskId,
    codeTaskId: primary.codeTaskId,
    commitSha,
    workBranch,
    execution,
    run: run ?? null,
    repoFullName: targetRepo.repoFullName,
    baseBranch,
    nowIso,
  });

  if (!isRealCursorSourceGenerationCompleted(wip)) {
    return {
      ok: false,
      message:
        "CodeTask commit 증거를 WIP 형식으로 변환하지 못했습니다. GitHub commit·변경 파일을 확인해 주세요.",
    };
  }

  const readiness = validateFinalScmIntegratedStageReadiness(wip);
  if (!readiness.ok) {
    return { ok: false, message: readiness.message };
  }

  return { ok: true, wip, synthesized: true };
}
