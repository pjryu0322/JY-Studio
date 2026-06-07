import {
  buildGithubOutcomeFromVerifyResult,
  patchRunWithGithubOutcome,
  type CodeTaskGithubOutcomeV1,
} from "@/lib/prototype/codeTaskGithubOutcome";
import {
  findLatestRunForCodeTask,
  updateCodeTaskExecutionRun,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { resolveCodeTaskWorkBranchForPlan } from "@/lib/prototype/codeTaskDisplayNameNormalize";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { runTaskCursorGithubVerifyCandidateFlow } from "@/lib/prototype/taskCursorGithubVerifyCandidateFlow";
import {
  evaluateTaskCursorGithubVerifyReadiness,
  type TaskCursorGithubVerifyResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { clearStaleTaskCursorInflightForVerifiedRun } from "@/lib/prototype/taskCursorGithubOutcomeSession";

export type VerifyGithubForCodeTaskRunResult = Readonly<{
  readonly ok: boolean;
  readonly githubOutcome: CodeTaskGithubOutcomeV1;
  readonly runPatch: Partial<CodeTaskExecutionRunV1>;
  readonly updatedRun: CodeTaskExecutionRunV1;
  readonly verify: TaskCursorGithubVerifyResult;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
  readonly taskCursorPatch?: TaskCursorExecutionV1;
  readonly nextDispatchAllowed: boolean;
  readonly message: string;
  readonly repaired: boolean;
}>;

export async function verifyGithubForCodeTaskRun(input: {
  readonly projectId: string;
  readonly run: CodeTaskExecutionRunV1;
  readonly execution: TaskCursorExecutionV1;
  readonly targetRepository: ProjectTargetRepository;
  readonly githubToken: string;
  readonly allowedPathGlobs: readonly string[];
  readonly codeTaskId: string;
  readonly branchPlanWorkBranch?: string | null;
  readonly nowIso?: string;
}): Promise<VerifyGithubForCodeTaskRunResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const previousWorkBranch = String(input.run.workBranch ?? input.execution.workBranch ?? "").trim() || null;
  const branchPlanWorkBranch =
    String(input.branchPlanWorkBranch ?? "").trim() ||
    String(previousWorkBranch ?? "").trim() ||
    null;
  const expectedCanonical = branchPlanWorkBranch ?? resolveCodeTaskWorkBranchForPlan(input.codeTaskId, previousWorkBranch);

  const candidateFlow = await runTaskCursorGithubVerifyCandidateFlow({
    projectId: input.projectId,
    execution: input.execution,
    targetRepository: input.targetRepository,
    githubToken: input.githubToken,
    allowedPathGlobs: input.allowedPathGlobs,
    codeTaskId: input.codeTaskId,
    branchPlanWorkBranch,
    runWorkBranch: input.run.workBranch ?? null,
    promptWorkBranch: expectedCanonical,
    executionRunId: input.run.runId,
    nowIso,
  });

  const resolvedBranch =
    candidateFlow.resolvedBranch ??
    candidateFlow.verify.resolvedBranch ??
    (candidateFlow.verify.ok ? previousWorkBranch : null);

  const githubOutcome = buildGithubOutcomeFromVerifyResult({
    verify: candidateFlow.verify,
    nowIso,
    previousWorkBranch,
    resolvedWorkBranch: resolvedBranch,
  });

  const runPatch = patchRunWithGithubOutcome({
    run: input.run,
    githubOutcome,
    nowIso,
  });

  const updatedRun: CodeTaskExecutionRunV1 = {
    ...input.run,
    ...runPatch,
    ...(runPatch.changedFiles ? { changedFiles: [...runPatch.changedFiles] } : {}),
  };

  const outcomeTimelineAction =
    githubOutcome.status === "verified"
      ? "code_task_github_outcome_verified"
      : githubOutcome.status === "failed"
        ? "code_task_github_outcome_failed"
        : "code_task_github_outcome_pending";

  const timeline: RequirementsPromptTimelineEntry[] = [
    ...candidateFlow.timeline,
    buildImplementationExecutionLogTimelineEntry({
      action: outcomeTimelineAction,
      orchestrationTraceGroup: "task_cursor_execution",
      routingDecision: input.run.processTaskId,
      fields: {
        projectId: input.projectId,
        runId: input.run.runId,
        codeTaskId: input.codeTaskId,
        processTaskId: input.run.processTaskId,
        ...(githubOutcome.status === "verified"
          ? {
              workBranch: githubOutcome.workBranch,
              commitSha: githubOutcome.commitSha.slice(0, 12),
              ...(githubOutcome.headSha ? { headSha: githubOutcome.headSha.slice(0, 12) } : {}),
              ...(githubOutcome.baseHeadSha ? { baseHeadSha: githubOutcome.baseHeadSha.slice(0, 12) } : {}),
              ...(githubOutcome.verifyQuality ? { verifyQuality: githubOutcome.verifyQuality } : {}),
              ...(githubOutcome.repairedWorkBranch ? { repairedWorkBranch: true } : {}),
              ...(githubOutcome.previousWorkBranch
                ? { previousWorkBranch: githubOutcome.previousWorkBranch }
                : {}),
            }
          : {}),
        ...(githubOutcome.status === "failed"
          ? {
              reason: githubOutcome.reason,
              retryable: githubOutcome.retryable,
              changedFileCount: candidateFlow.verify.verifiedChangedFiles?.length ?? 0,
            }
          : {}),
      },
      nowIso,
    }),
    buildImplementationExecutionLogTimelineEntry({
      action: "code_task_github_outcome_persisted",
      orchestrationTraceGroup: "task_cursor_execution",
      routingDecision: input.run.processTaskId,
      fields: {
        projectId: input.projectId,
        runId: input.run.runId,
        codeTaskId: input.codeTaskId,
        outcomeStatus: githubOutcome.status,
      },
      nowIso,
    }),
  ];

  const sessionClear = clearStaleTaskCursorInflightForVerifiedRun({
    execution: candidateFlow.execution,
    githubOutcome,
    nowIso,
  });
  if (sessionClear.cleared) {
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "task_cursor_stale_inflight_cleared",
        orchestrationTraceGroup: "task_cursor_execution",
        routingDecision: input.run.processTaskId,
        fields: {
          projectId: input.projectId,
          taskId: input.run.processTaskId,
          priorStatus: sessionClear.priorStatus ?? "github_verifying",
          reason: "run_github_outcome_verified",
        },
        nowIso,
      }),
    );
  }

  return {
    ok: candidateFlow.verify.ok,
    githubOutcome,
    runPatch,
    updatedRun,
    verify: candidateFlow.verify,
    timeline,
    ...(sessionClear.execution ? { taskCursorPatch: sessionClear.execution } : {}),
    nextDispatchAllowed: githubOutcome.status === "verified",
    message:
      githubOutcome.status === "verified"
        ? "GitHub commit 확인 완료"
        : githubOutcome.status === "failed"
          ? String(githubOutcome.message ?? "GitHub verify failed")
          : "GitHub commit 확인 중",
    repaired: candidateFlow.repaired,
  };
}

export function applyGithubOutcomeToRunsList(input: {
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly codeTaskId: string;
  readonly updatedRun: CodeTaskExecutionRunV1;
}): CodeTaskExecutionRunV1[] {
  const id = input.codeTaskId.trim();
  const latest = findLatestRunForCodeTask(input.runs, id);
  if (latest?.runId === input.updatedRun.runId) {
    return updateCodeTaskExecutionRun(input.runs as CodeTaskExecutionRunV1[], input.updatedRun.runId, input.updatedRun);
  }
  return input.runs.map((r) => (r.runId === input.updatedRun.runId ? input.updatedRun : r));
}

export function evaluateGithubVerifyReadinessFromSetup(
  setup: Parameters<typeof evaluateTaskCursorGithubVerifyReadiness>[0]["setup"],
) {
  return evaluateTaskCursorGithubVerifyReadiness({ setup });
}
