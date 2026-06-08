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
import { patchTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { clearStaleTaskCursorInflightForVerifiedRun } from "@/lib/prototype/taskCursorGithubOutcomeSession";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  isInvalidVerifyBranchContext,
  repairLegacyMockProcessTaskId,
  resolveCanonicalCodeTaskRunTarget,
} from "@/lib/prototype/codeTaskRunTargetCanonical";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import {
  buildExecutionUnitGithubVerifyPatch,
  buildExecutionUnitVerifyingPatch,
  ensurePersistedImplementationExecutionUnits,
} from "@/lib/prototype/implementationExecutionRuntime";

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
  readonly executionUnitsOrchestrationPatch?: Partial<RequirementsStateJson>;
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
  readonly codeTask?: ImplementationCodeTaskV1 | null;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly nowIso?: string;
}): Promise<VerifyGithubForCodeTaskRunResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const runCodeTaskId = String(input.run.codeTaskId ?? input.codeTaskId ?? "").trim();
  if (runCodeTaskId && runCodeTaskId !== String(input.codeTaskId ?? "").trim()) {
    return {
      ok: false,
      githubOutcome: {
        status: "failed",
        checkedAt: nowIso,
        reason: "github_api_error",
        retryable: false,
        message: "github_outcome_code_task_mismatch",
      },
      runPatch: {},
      updatedRun: input.run,
      verify: { ok: false, reason: "github_verify_failed", message: "github_outcome_code_task_mismatch" },
      timeline: [],
      nextDispatchAllowed: false,
      message: "Run CodeTask ID와 verify 대상 CodeTask ID가 일치하지 않습니다.",
      repaired: false,
    };
  }

  const canonicalTarget = input.codeTask ? resolveCanonicalCodeTaskRunTarget({ codeTask: input.codeTask }) : null;
  const branchPlan = parseCodeTaskBranchPlanV1(input.codeTask?.branchPlan);
  const branchPlanWorkBranch =
    String(canonicalTarget?.workBranch ?? input.branchPlanWorkBranch ?? "").trim() ||
    String(input.run.workBranch ?? input.execution.workBranch ?? "").trim() ||
    null;
  const branchPlanBaseBranch =
    String(canonicalTarget?.baseBranch ?? branchPlan?.baseBranch ?? input.execution.baseBranch ?? "").trim() ||
    null;

  const processTaskId =
    canonicalTarget?.processTaskId ??
    repairLegacyMockProcessTaskId({
      taskId: input.run.processTaskId,
      codeTaskId: input.codeTaskId,
      branchGroup: branchPlan?.branchGroup ?? null,
    });

  let execution = patchTaskCursorExecution(input.execution, {
    taskId: processTaskId,
    ...(branchPlanBaseBranch ? { baseBranch: branchPlanBaseBranch } : {}),
    ...(branchPlanWorkBranch ? { workBranch: branchPlanWorkBranch } : {}),
    nowIso,
  });

  if (
    branchPlanBaseBranch &&
    branchPlanWorkBranch &&
    isInvalidVerifyBranchContext({ baseBranch: branchPlanBaseBranch, workBranch: branchPlanWorkBranch })
  ) {
    const verify: TaskCursorGithubVerifyResult = {
      ok: false,
      reason: "github_verify_failed",
      detailReason: "no_new_commit",
      message: "GitHub verify context invalid: baseBranch와 workBranch가 동일합니다.",
    };
    return {
      ok: false,
      githubOutcome: buildGithubOutcomeFromVerifyResult({
        verify,
        nowIso,
        previousWorkBranch: branchPlanWorkBranch,
        resolvedWorkBranch: branchPlanWorkBranch,
      }),
      runPatch: {},
      updatedRun: input.run,
      verify,
      timeline: [
        buildImplementationExecutionLogTimelineEntry({
          action: "task_cursor_github_verify_invalid_context",
          orchestrationTraceGroup: "task_cursor_execution",
          routingDecision: processTaskId,
          fields: {
            projectId: input.projectId,
            codeTaskId: input.codeTaskId,
            processTaskId,
            baseBranch: branchPlanBaseBranch,
            workBranch: branchPlanWorkBranch,
          },
          nowIso,
        }),
      ],
      nextDispatchAllowed: false,
      message: verify.message ?? "invalid verify context",
      repaired: false,
    };
  }

  const previousWorkBranch = String(input.run.workBranch ?? execution.workBranch ?? "").trim() || null;
  const expectedCanonical = branchPlanWorkBranch ?? resolveCodeTaskWorkBranchForPlan(input.codeTaskId, previousWorkBranch);

  let executionUnitsOrchestrationPatch: Partial<RequirementsStateJson> | undefined;
  let verifyingTimeline: RequirementsPromptTimelineEntry[] = [];
  if (input.requirementsState) {
    const codeTaskPlanBootstrap = parseImplementationCodeTaskPlanV1(
      input.requirementsState.implementationCodeTaskPlanV1,
    );
    const taskListBootstrap = parseImplementationTaskListV1(input.requirementsState.implementationTaskListV1);
    const runsBootstrap = parseCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1) ?? [];
    const ensuredBootstrap = ensurePersistedImplementationExecutionUnits({
      projectId: input.projectId,
      requirementsState: input.requirementsState,
      codeTaskPlan: codeTaskPlanBootstrap,
      taskList: taskListBootstrap,
      runs: runsBootstrap,
      nowIso,
    });
    const stateForVerifying = {
      ...input.requirementsState,
      ...ensuredBootstrap.orchestrationPatch,
    } as RequirementsStateJson;
    const verifyingPatch = buildExecutionUnitVerifyingPatch({
      state: stateForVerifying,
      projectId: input.projectId,
      codeTaskId: input.codeTaskId,
      nowIso,
    });
    executionUnitsOrchestrationPatch = {
      ...ensuredBootstrap.orchestrationPatch,
      ...verifyingPatch.orchestrationPatch,
    };
    verifyingTimeline = [...verifyingPatch.timeline];
  }

  const candidateFlow = await runTaskCursorGithubVerifyCandidateFlow({
    projectId: input.projectId,
    execution,
    targetRepository: input.targetRepository,
    githubToken: input.githubToken,
    allowedPathGlobs: input.allowedPathGlobs,
    codeTaskId: input.codeTaskId,
    branchPlanWorkBranch,
    runWorkBranch: input.run.workBranch ?? branchPlanWorkBranch ?? null,
    promptWorkBranch: expectedCanonical,
    executionRunId: input.run.runId,
    branchPlanBaseBranch: branchPlanBaseBranch,
    branchGroup: branchPlan?.branchGroup ?? canonicalTarget?.branchGroup ?? null,
    nowIso,
  });

  execution = candidateFlow.execution;

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
    expectedCodeTaskId: input.codeTaskId,
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
    ...verifyingTimeline,
    ...candidateFlow.timeline,
    buildImplementationExecutionLogTimelineEntry({
      action: outcomeTimelineAction,
      orchestrationTraceGroup: "task_cursor_execution",
      routingDecision: processTaskId,
      fields: {
        projectId: input.projectId,
        runId: input.run.runId,
        codeTaskId: input.codeTaskId,
        processTaskId,
        taskId: processTaskId,
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
      routingDecision: processTaskId,
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
        routingDecision: processTaskId,
        fields: {
          projectId: input.projectId,
          taskId: processTaskId,
          priorStatus: sessionClear.priorStatus ?? "github_verifying",
          reason: "run_github_outcome_verified",
        },
        nowIso,
      }),
    );
  }

  let executionUnitsOrchestrationPatchAfterVerify: Partial<RequirementsStateJson> | undefined =
    executionUnitsOrchestrationPatch;
  if (input.requirementsState) {
    const codeTaskPlan = parseImplementationCodeTaskPlanV1(
      input.requirementsState.implementationCodeTaskPlanV1,
    );
    const taskList = parseImplementationTaskListV1(input.requirementsState.implementationTaskListV1);
    const runs = parseCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1) ?? [];
    const ensured = ensurePersistedImplementationExecutionUnits({
      projectId: input.projectId,
      requirementsState: input.requirementsState,
      codeTaskPlan,
      taskList,
      runs: applyGithubOutcomeToRunsList({
        runs,
        codeTaskId: input.codeTaskId,
        updatedRun,
      }),
      nowIso,
    });
    const stateForPatch = {
      ...input.requirementsState,
      ...ensured.orchestrationPatch,
      ...(executionUnitsOrchestrationPatch ?? {}),
    };
    const unitPatch = buildExecutionUnitGithubVerifyPatch({
      state: stateForPatch,
      projectId: input.projectId,
      codeTaskId: input.codeTaskId,
      githubOutcome,
      run: updatedRun,
      nowIso,
    });
    executionUnitsOrchestrationPatchAfterVerify = {
      ...executionUnitsOrchestrationPatch,
      ...ensured.orchestrationPatch,
      ...unitPatch.orchestrationPatch,
    };
    timeline.push(...unitPatch.timeline, ...ensured.timeline);
  }

  return {
    ok: candidateFlow.verify.ok,
    githubOutcome,
    runPatch,
    updatedRun,
    verify: candidateFlow.verify,
    timeline,
    ...(sessionClear.execution ? { taskCursorPatch: sessionClear.execution } : { taskCursorPatch: execution }),
    nextDispatchAllowed: githubOutcome.status === "verified",
    message:
      githubOutcome.status === "verified"
        ? "GitHub commit 확인 완료"
        : githubOutcome.status === "failed"
          ? String(githubOutcome.message ?? "GitHub verify failed")
          : "GitHub commit 확인 중",
    repaired: candidateFlow.repaired,
    ...(executionUnitsOrchestrationPatchAfterVerify
      ? { executionUnitsOrchestrationPatch: executionUnitsOrchestrationPatchAfterVerify }
      : {}),
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
