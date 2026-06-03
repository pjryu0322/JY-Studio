import path from "node:path";
import { buildProviderWipCommitMessage } from "@/lib/prototype/codeAgentProvider";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { ensureTargetRepositoryWorktree } from "@/lib/prototype/cursorBridgeTargetRepoGit";
import { evaluateCursorExecutionAvailability } from "@/lib/prototype/cursorExecutionAvailability";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import { resolveDefaultGitWorkspaceCloneRoot } from "@/lib/prototype/gitRepoAutoWorkspace";
import { validateWorkspaceMatchesTargetRepository } from "@/lib/prototype/workspaceTargetRepositoryValidation";
import {
  buildTaskCursorApiFailedTimeline,
  buildTaskCursorApiStartedTimeline,
  buildTaskCursorExecutionRequest,
  buildTaskCursorOrchestrationPatch,
  buildTaskCursorRequestedTimeline,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { launchTaskCursorCloudAgent } from "@/lib/prototype/taskCursorCloudAgentClient";
import { shouldUseTaskCursorCloudAgentApi } from "@/lib/prototype/taskCursorApiClient";
import { patchTaskCursorExecution, TASK_CURSOR_FAILURE_MESSAGES } from "@/lib/prototype/taskCursorExecution";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { prisma } from "@/lib/prisma";

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  workspacePath: true,
  allowedPathGlobs: true,
  cursorApiUrl: true,
  cursorApiToken: true,
  githubAccessToken: true,
} as const;

export async function launchTaskCursorForProject(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly workItems: readonly CursorWorkItem[];
  readonly nowIso?: string;
}): Promise<
  Readonly<{
    readonly ok: boolean;
    readonly message?: string;
    readonly execution?: ReturnType<typeof patchTaskCursorExecution>;
    readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  }>
> {
  const projectId = input.projectId.trim();
  const taskId = input.taskId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const scopedWorkItems = input.workItems.filter((w) => w.taskId === taskId);
  if (!scopedWorkItems.length) {
    return { ok: false, message: `${taskId}에 해당하는 WorkItem이 없습니다.` };
  }

  const setupRow = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: EXECUTION_SETUP_SELECT,
  });
  const setup = mapExecutionSetupPrismaRowToSourceGenerationRow(setupRow);
  const readiness = evaluateExecutionSetupSourceGenerationReadiness({
    setup,
    env: process.env as Record<string, string | undefined>,
  });
  const availability = evaluateCursorExecutionAvailability({ setup });
  if (!readiness.ok) return { ok: false, message: readiness.message };
  const cursorApiToken = String(setupRow?.cursorApiToken ?? "").trim();
  const githubToken = String(setupRow?.githubAccessToken ?? "").trim();
  if (!cursorApiToken) {
    return { ok: false, message: TASK_CURSOR_FAILURE_MESSAGES.cursor_auth_failed };
  }
  if (!githubToken) {
    return { ok: false, message: TASK_CURSOR_FAILURE_MESSAGES.github_auth_failed };
  }
  if (!availability.ready) return { ok: false, message: availability.reason };

  const { context } = readiness;
  let workspaceRoot = context.workspaceRoot;
  if (context.workspaceRootSource === "execution_setup") {
    const workspaceMatch = await validateWorkspaceMatchesTargetRepository({
      workspacePath: workspaceRoot,
      targetRepoFullName: context.targetRepository.repoFullName,
    });
    if (!workspaceMatch.ok) return { ok: false, message: workspaceMatch.reason };
  } else if (context.workspaceRootSource === "git_repo_auto") {
    const cloneRootRaw = resolveDefaultGitWorkspaceCloneRoot(
      process.env as Record<string, string | undefined>,
    );
    const cloneRoot = path.isAbsolute(cloneRootRaw) ? cloneRootRaw : path.join(process.cwd(), cloneRootRaw);
    const workBranch = `wip/cursor/${taskId.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}`;
    try {
      const prepared = await ensureTargetRepositoryWorktree({
        cloneRoot,
        targetRepository: context.targetRepository,
        baseBranch: context.baseBranch,
        workBranch,
      });
      workspaceRoot = prepared.workdir;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Git 작업공간 준비 실패: ${message}` };
    }
  }

  let execution = buildTaskCursorExecutionRequest({
    projectId,
    taskId,
    workItemIds: scopedWorkItems.map((w) => w.id),
    workItems: scopedWorkItems,
    targetRepository: context.targetRepository,
    baseBranch: context.baseBranch,
    allowedPathGlobs: context.allowedPathGlobs,
    nowIso,
  });
  execution = patchTaskCursorExecution(execution, { status: "cursor_requested", nowIso });
  const timeline = [
    ...buildTaskCursorRequestedTimeline({ execution, nowIso }),
    buildTaskCursorApiStartedTimeline({ execution, nowIso }),
  ];
  execution = patchTaskCursorExecution(execution, { status: "cursor_running", nowIso });

  const commitMessage = buildProviderWipCommitMessage("cursor", `task ${taskId}`, false, taskId);
  const apiRequest = {
    projectId,
    taskId,
    workItemIds: scopedWorkItems.map((w) => w.id),
    workItems: scopedWorkItems,
    cursorApiUrl: readiness.context.cursorApiUrl!,
    cursorApiToken,
    targetRepository: context.targetRepository,
    workspacePath: workspaceRoot,
    baseBranch: context.baseBranch,
    workBranch: execution.workBranch,
    commitMessage,
    prompt: execution.cursorPrompt ?? "",
    allowedPathGlobs: context.allowedPathGlobs,
  };

  if (!shouldUseTaskCursorCloudAgentApi(readiness.context.cursorApiUrl!)) {
    return { ok: false, message: TASK_CURSOR_FAILURE_MESSAGES.cursor_endpoint_unsupported };
  }

  const launch = await launchTaskCursorCloudAgent(apiRequest);
  const { syncDbImplementationRuntimeAfterTaskCursorChange } = await import(
    "@/lib/prototype/prototypeExecutionTaskCursorActions"
  );

  if (!launch.ok) {
    execution = patchTaskCursorExecution(execution, {
      status: "cursor_failed",
      failureReason: launch.reason,
      errorMessage: launch.message,
      nowIso,
    });
    timeline.push(buildTaskCursorApiFailedTimeline({ execution, nowIso }));
    await syncDbImplementationRuntimeAfterTaskCursorChange({
      projectId,
      taskId,
      execution,
      nowIso,
    });
  } else {
    execution = patchTaskCursorExecution(execution, {
      status: "cursor_running",
      cursorRunId: launch.agentId,
      nowIso,
    });
    await syncDbImplementationRuntimeAfterTaskCursorChange({
      projectId,
      taskId,
      execution,
      nowIso,
    });
  }

  const orchestrationPatch = buildTaskCursorOrchestrationPatch({
    execution,
    timelineEntries: timeline,
    cursorWorkItems: scopedWorkItems,
  });
  return { ok: launch.ok, message: launch.ok ? undefined : launch.message, execution, orchestrationPatch };
}
