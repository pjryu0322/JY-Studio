import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  advanceQuickRunOrchestrationAfterGithubVerify,
  type QuickRunGithubAdvanceResult,
} from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import { applyGithubVerifyStuckEscalationIfNeeded } from "@/lib/prototype/taskCursorGithubVerifyEscalation";
import {
  applyTaskCursorGithubVerifyResult,
  buildTaskCursorGithubVerifyTimeline,
  buildTaskCursorOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import type { TaskCursorGithubVerifyRequestBody } from "@/lib/prototype/taskCursorGithubVerifyTypes";
import {
  evaluateTaskCursorGithubVerifyReadiness,
  type TaskCursorGithubVerifyResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import {
  applyGithubVerifyStateSyncGuard,
  mapManualGithubVerifyApiStatus,
  runTaskCursorGithubVerifyCandidateFlow,
} from "@/lib/prototype/taskCursorGithubVerifyCandidateFlow";
import {
  buildTaskCursorTimelineEntry,
  patchTaskCursorExecution,
  TASK_CURSOR_FAILURE_MESSAGES,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { syncImplementationRuntimeFromTaskCursor } from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  applyGithubOutcomeToRunsList,
  verifyGithubForCodeTaskRun,
} from "@/lib/prototype/codeTaskGithubVerifyForRun";
import {
  buildGithubOutcomeFromVerifyResult,
  patchRunWithGithubOutcome,
} from "@/lib/prototype/codeTaskGithubOutcome";
import { clearStaleTaskCursorInflightForVerifiedRun } from "@/lib/prototype/taskCursorGithubOutcomeSession";
import {
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { mergeCodeTaskRunsWithDbRuntime } from "@/lib/prototype/implementationQuickRunStuckGithubRecovery";
import { applyQuickRunContinuationAfterGithubVerify } from "@/lib/prototype/quickRunContinuationAfterGithubVerify";
import { mergeRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import {
  repairLegacyMockProcessTaskId,
  resolveCanonicalCodeTaskRunTarget,
} from "@/lib/prototype/codeTaskRunTargetCanonical";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  cursorApiUrl: true,
  cursorApiToken: true,
  allowedPathGlobs: true,
  githubAccessToken: true,
} as const;

export type TaskCursorGithubVerifyBlocked = Readonly<{
  readonly kind: "blocked";
  readonly message: string;
  readonly status?: string;
}>;

export type TaskCursorGithubVerifySuccess = Readonly<{
  readonly kind: "ok";
  readonly verify: TaskCursorGithubVerifyResult;
  readonly execution: TaskCursorExecutionV1;
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly advance: QuickRunGithubAdvanceResult;
  readonly continuationDispatchedOnServer?: boolean;
  readonly repaired?: boolean;
  readonly resolvedBranch?: string | null;
  readonly manualVerifyStatus?: ReturnType<typeof mapManualGithubVerifyApiStatus>;
}>;

export type TaskCursorGithubVerifyOutcome = TaskCursorGithubVerifyBlocked | TaskCursorGithubVerifySuccess;

function resolveGithubVerifyCodeTaskId(input: {
  readonly bodyCodeTaskId?: string | null;
  readonly executionWorkBranch?: string | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly mergedRuns: readonly CodeTaskExecutionRunV1[];
  readonly dbCurrentRunCodeTaskId?: string | null;
  readonly dbJobCurrentCodeTaskId?: string | null;
}): string {
  const fromBody = String(input.bodyCodeTaskId ?? "").trim();
  if (fromBody) return fromBody;
  const workBranch = String(input.executionWorkBranch ?? "").trim();
  if (workBranch && input.codeTaskPlan?.tasks?.length) {
    for (const task of input.codeTaskPlan.tasks) {
      const branchPlan = parseCodeTaskBranchPlanV1(task.branchPlan);
      if (String(branchPlan?.workBranch ?? "").trim() === workBranch) {
        return task.codeTaskId.trim();
      }
    }
  }
  const inFlight = [...input.mergedRuns]
    .filter((run) => isInFlightCodeTaskExecutionRunStatus(run.status))
    .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))[0];
  if (inFlight?.codeTaskId?.trim()) return inFlight.codeTaskId.trim();
  return (
    String(input.dbJobCurrentCodeTaskId ?? "").trim() ||
    String(input.dbCurrentRunCodeTaskId ?? "").trim()
  );
}

export function validateTaskCursorGithubVerifyExecution(
  execution: TaskCursorExecutionV1,
): TaskCursorGithubVerifyBlocked | null {
  if (execution.status === "cursor_requested") {
    return {
      kind: "blocked",
      status: "blocked",
      message:
        "Cursor 실행 요청이 아직 처리 중입니다. 잠시 후 다시 시도하거나 상단 툴바에서 실행 상태를 확인해 주세요.",
    };
  }
  const needsBranch =
    execution.status === "cursor_running" ||
    execution.status === "cursor_failed" ||
    execution.status === "github_verify_failed";
  if (needsBranch && !String(execution.workBranch ?? "").trim()) {
    return {
      kind: "blocked",
      status: "blocked",
      message:
        execution.status === "cursor_running"
          ? "WIP branch가 없어 GitHub commit 확인을 할 수 없습니다. Cursor 실행이 완료된 뒤 다시 시도해 주세요."
          : "WIP branch가 없어 GitHub commit 확인을 할 수 없습니다.",
    };
  }
  return null;
}

export async function runTaskCursorGithubVerifyWithQuickRunAdvance(input: {
  readonly projectId: string;
  readonly body: TaskCursorGithubVerifyRequestBody;
  readonly execution: TaskCursorExecutionV1;
}): Promise<TaskCursorGithubVerifyOutcome> {
  const projectId = input.projectId.trim();
  const body = input.body;
  const execution = input.execution;
  const blocked = validateTaskCursorGithubVerifyExecution(execution);
  if (blocked) return blocked;

  const setupRow = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: EXECUTION_SETUP_SELECT,
  });
  const setup = mapExecutionSetupPrismaRowToSourceGenerationRow(setupRow);
  const readiness = evaluateTaskCursorGithubVerifyReadiness({ setup });
  if (!readiness.ok) {
    return { kind: "blocked", status: "blocked", message: readiness.message };
  }

  const githubToken = String(setupRow?.githubAccessToken ?? "").trim();
  if (!githubToken) {
    return {
      kind: "blocked",
      status: "blocked",
      message: TASK_CURSOR_FAILURE_MESSAGES.github_auth_failed,
    };
  }

  const nowIso = new Date().toISOString();
  let nextExecution = patchTaskCursorExecution(execution, {
    status: "github_verifying",
    githubProgressLastCheckAt: nowIso,
    nowIso,
  });

  const dbBundlePre = await getImplementationRuntimeBundle(projectId);
  const codeTaskPlanEarly = parseImplementationCodeTaskPlanV1(body.implementationCodeTaskPlanV1);
  const runsFromBody = parseCodeTaskExecutionRunsV1(body.codeTaskExecutionRunsV1) ?? [];
  const mergedRuns = mergeCodeTaskRunsWithDbRuntime({
    jsonRuns: runsFromBody,
    dbBundle: dbBundlePre,
    codeTaskPlan: codeTaskPlanEarly,
  });
  const codeTaskIdEarly = resolveGithubVerifyCodeTaskId({
    bodyCodeTaskId: body.codeTaskId,
    executionWorkBranch: execution.workBranch,
    codeTaskPlan: codeTaskPlanEarly,
    mergedRuns,
    dbCurrentRunCodeTaskId: dbBundlePre.currentRun?.codeTaskId,
    dbJobCurrentCodeTaskId: dbBundlePre.job?.currentCodeTaskId,
  });
  const runForVerify = codeTaskIdEarly ? findLatestRunForCodeTask(mergedRuns, codeTaskIdEarly) : null;
  const codeTaskForVerify =
    codeTaskPlanEarly?.tasks.find((t) => t.codeTaskId === codeTaskIdEarly) ?? null;
  const branchPlanParsed = parseCodeTaskBranchPlanV1(codeTaskForVerify?.branchPlan);
  const branchPlanWorkBranch = String(branchPlanParsed?.workBranch ?? "").trim() || null;
  const canonicalTarget = codeTaskForVerify
    ? resolveCanonicalCodeTaskRunTarget({ codeTask: codeTaskForVerify })
    : null;
  const verifyProcessTaskId =
    canonicalTarget?.processTaskId ??
    repairLegacyMockProcessTaskId({
      taskId: runForVerify?.processTaskId ?? nextExecution.taskId,
      codeTaskId: codeTaskIdEarly,
      branchGroup: branchPlanParsed?.branchGroup ?? null,
    });

  nextExecution = patchTaskCursorExecution(nextExecution, {
    taskId: verifyProcessTaskId,
    ...(branchPlanParsed?.baseBranch
      ? { baseBranch: String(branchPlanParsed.baseBranch).trim() }
      : {}),
    ...(branchPlanWorkBranch ? { workBranch: branchPlanWorkBranch } : {}),
    nowIso,
  });

  const timeline = [
    buildTaskCursorTimelineEntry({
      action: "task_cursor_github_verify_requested",
      projectId,
      taskId: verifyProcessTaskId,
      status: "github_verifying",
      targetRepository: nextExecution.targetRepository,
      baseBranch: nextExecution.baseBranch,
      workBranch: branchPlanWorkBranch ?? nextExecution.workBranch,
      commitSha: nextExecution.commitSha,
      runId: runForVerify?.runId ?? nextExecution.cursorRunId,
      nowIso,
    }),
  ];

  const dbRunEarly = codeTaskIdEarly
    ? dbBundlePre.runs.find((r) => r.codeTaskId === codeTaskIdEarly) ?? null
    : dbBundlePre.currentRun;

  let runsAfterOutcome = mergedRuns.length ? mergedRuns : runsFromBody;
  let verify: TaskCursorGithubVerifyResult;
  let verifyRepairMeta: { repaired: boolean; resolvedBranch: string | null } = {
    repaired: false,
    resolvedBranch: null,
  };
  let executionUnitsOrchestrationPatch: Partial<import("@/lib/requirements/requirementsStateJson").RequirementsStateJson> | undefined;

  if (runForVerify) {
    const githubVerifyRequirementsState = mergeRequirementsStateJson(
      parseRequirementsStateJson({}) ?? {},
      {
        implementationCodeTaskPlanV1: body.implementationCodeTaskPlanV1,
        implementationTaskListV1: body.implementationTaskListV1,
        codeTaskExecutionRunsV1: mergedRuns.length ? mergedRuns : runsFromBody,
        ...(("implementationExecutionUnitsV1" in body
          ? { implementationExecutionUnitsV1: (body as Record<string, unknown>).implementationExecutionUnitsV1 }
          : {}) as object),
      },
    );
    const forRun = await verifyGithubForCodeTaskRun({
      projectId,
      run: runForVerify,
      execution: nextExecution,
      targetRepository: readiness.targetRepository,
      githubToken,
      allowedPathGlobs: readiness.allowedPathGlobs,
      codeTaskId: codeTaskIdEarly,
      branchPlanWorkBranch,
      codeTask: codeTaskForVerify,
      requirementsState: githubVerifyRequirementsState,
      nowIso,
    });
    timeline.push(...forRun.timeline);
    verify = forRun.verify;
    runsAfterOutcome = applyGithubOutcomeToRunsList({
      runs: runsAfterOutcome,
      codeTaskId: codeTaskIdEarly,
      updatedRun: forRun.updatedRun,
    });
    nextExecution = forRun.taskCursorPatch ?? nextExecution;
    nextExecution = applyTaskCursorGithubVerifyResult({
      execution: nextExecution,
      ok: verify.ok,
      message: verify.message,
      reason: verify.reason,
      detailReason: verify.detailReason,
      verifiedChangedFiles: verify.verifiedChangedFiles,
      verifiedCommitSha: verify.verifiedCommitSha,
      nowIso,
    });
    verifyRepairMeta = {
      repaired: forRun.repaired,
      resolvedBranch: forRun.verify.resolvedBranch ?? null,
    };
    executionUnitsOrchestrationPatch = forRun.executionUnitsOrchestrationPatch;
  } else {
    const candidateFlow = await runTaskCursorGithubVerifyCandidateFlow({
      projectId,
      execution: nextExecution,
      targetRepository: readiness.targetRepository,
      githubToken,
      allowedPathGlobs: readiness.allowedPathGlobs,
      codeTaskId: codeTaskIdEarly || null,
      branchPlanWorkBranch,
      runWorkBranch: runForVerify?.workBranch ?? dbRunEarly?.branchName ?? null,
      branchPlanBaseBranch: branchPlanParsed?.baseBranch ?? null,
      branchGroup: branchPlanParsed?.branchGroup ?? canonicalTarget?.branchGroup ?? null,
      nowIso,
    });
    timeline.push(...candidateFlow.timeline);
    nextExecution = candidateFlow.execution;
    verify = candidateFlow.verify;
    nextExecution = applyTaskCursorGithubVerifyResult({
      execution: nextExecution,
      ok: verify.ok,
      message: verify.message,
      reason: verify.reason,
      detailReason: verify.detailReason,
      verifiedChangedFiles: verify.verifiedChangedFiles,
      verifiedCommitSha: verify.verifiedCommitSha,
      nowIso,
    });
    if (verify.ok && verify.verifiedCommitSha && codeTaskIdEarly) {
      const runToPatch =
        runForVerify ??
        findLatestRunForCodeTask(mergedRuns, codeTaskIdEarly);
      if (runToPatch) {
        const outcome = buildGithubOutcomeFromVerifyResult({
          verify,
          nowIso,
          previousWorkBranch: runToPatch.workBranch ?? nextExecution.workBranch,
          resolvedWorkBranch: verify.resolvedBranch ?? null,
        });
        const updatedRun: CodeTaskExecutionRunV1 = {
          ...runToPatch,
          ...patchRunWithGithubOutcome({ run: runToPatch, githubOutcome: outcome, nowIso }),
        };
        runsAfterOutcome = applyGithubOutcomeToRunsList({
          runs: runsAfterOutcome.length ? runsAfterOutcome : mergedRuns,
          codeTaskId: codeTaskIdEarly,
          updatedRun,
        });
        const session = clearStaleTaskCursorInflightForVerifiedRun({
          execution: nextExecution,
          githubOutcome: outcome,
          nowIso,
        });
        if (session.execution) nextExecution = session.execution;
      }
    }
    verifyRepairMeta = {
      repaired: candidateFlow.repaired,
      resolvedBranch: candidateFlow.resolvedBranch ?? verify.resolvedBranch ?? null,
    };
  }

  const escalation = applyGithubVerifyStuckEscalationIfNeeded({
    execution: nextExecution,
    verifyDetailReason: verify.detailReason,
    codeTaskId: String(body.codeTaskId ?? "").trim() || null,
    nowIso,
  });
  nextExecution = escalation.execution;
  if (escalation.timelineEntry) {
    timeline.push(escalation.timelineEntry);
  }
  if (nextExecution.status === "github_verified") {
    nextExecution = patchTaskCursorExecution(nextExecution, { status: "review_pending", nowIso });
  }
  timeline.push(
    buildTaskCursorGithubVerifyTimeline({
      execution: nextExecution,
      ok: verify.ok,
      reason: verify.reason,
      nowIso,
    }),
  );

  await syncImplementationRuntimeFromTaskCursor({
    projectId,
    codeTaskId: codeTaskIdEarly || undefined,
    taskId: nextExecution.taskId,
    execution: nextExecution,
    githubVerifyResult: verify,
  });

  const stateSync = await applyGithubVerifyStateSyncGuard({
    projectId,
    codeTaskId: codeTaskIdEarly || nextExecution.taskId,
    execution: nextExecution,
    verify,
    nowIso,
  });
  nextExecution = stateSync.execution;
  if (stateSync.timeline) timeline.push(stateSync.timeline);

  const dbBundle = await getImplementationRuntimeBundle(projectId);
  const codeTaskId =
    codeTaskIdEarly ||
    dbBundle.currentRun?.codeTaskId?.trim() ||
    dbBundle.job?.currentCodeTaskId?.trim() ||
    "";

  const workItems = body.workItems ?? [];
  const codeTaskPlan = codeTaskPlanEarly ?? parseImplementationCodeTaskPlanV1(body.implementationCodeTaskPlanV1);
  const taskList = parseImplementationTaskListV1(body.implementationTaskListV1);
  const dispatchTarget = codeTaskId
    ? resolveCodeTaskDispatchTarget({
        codeTaskId,
        codeTaskPlan,
        taskList,
        cursorWorkItems: workItems,
      })
    : null;

  const runsPayload =
    runsAfterOutcome.length > 0 ? runsAfterOutcome : body.codeTaskExecutionRunsV1;

  const basePatch = mergeOrchestrationPersistPatches(
    buildTaskCursorOrchestrationPatch({
      execution: nextExecution,
      timelineEntries: timeline,
      cursorWorkItems: workItems,
      codeTaskExecutionRunsV1: runsPayload,
      activeCodeTaskId: (dispatchTarget?.codeTask.codeTaskId ?? codeTaskId) || null,
      activeWorkItemId: dispatchTarget?.workItem.id ?? null,
      ...(parseImplementationTaskExecutionStateV1(body.implementationTaskExecutionStateV1)
        ? {
            executionState: parseImplementationTaskExecutionStateV1(
              body.implementationTaskExecutionStateV1,
            ),
          }
        : {}),
    }),
    executionUnitsOrchestrationPatch ?? {},
  );

  const dbBundleAfter = await getImplementationRuntimeBundle(projectId);

  const advance = advanceQuickRunOrchestrationAfterGithubVerify({
    projectId,
    githubVerifyOk: verify.ok,
    basePatch,
    quickRun: body.implementationQuickRunV1,
    implementationTaskListV1: body.implementationTaskListV1,
    implementationCodeTaskPlanV1: body.implementationCodeTaskPlanV1,
    codeTaskExecutionRunsV1: runsPayload,
    implementationTaskExecutionStateV1: body.implementationTaskExecutionStateV1,
    implementationQualityGateResultsV1: body.implementationQualityGateResultsV1,
    implementationAutoQualityGateV1: body.implementationAutoQualityGateV1,
    implementationAutoQualityGateHistoryV1: body.implementationAutoQualityGateHistoryV1,
    cursorWorkItemsV1: workItems,
    promptTimeline: body.promptTimeline,
    codeTaskExecutionQueueV1: body.codeTaskExecutionQueueV1,
    dbBundle: dbBundleAfter,
    nowIso,
  });

  const execReadiness = evaluateExecutionSetupSourceGenerationReadiness({
    setup,
    env: process.env as Record<string, string | undefined>,
  });

  const continuation = await applyQuickRunContinuationAfterGithubVerify({
    projectId,
    verify,
    advance,
    requirementsSlice: mergeRequirementsStateJson(
      {
        promptTimeline: body.promptTimeline ?? [],
        implementationQuickRunV1: body.implementationQuickRunV1,
        implementationTaskListV1: body.implementationTaskListV1,
        implementationCodeTaskPlanV1: body.implementationCodeTaskPlanV1,
        codeTaskExecutionRunsV1: runsPayload,
        codeTaskExecutionQueueV1: body.codeTaskExecutionQueueV1,
        cursorWorkItemsV1: workItems,
        taskCursorExecutionV1: nextExecution,
        ...(executionUnitsOrchestrationPatch ?? {}),
      },
      basePatch as Record<string, unknown>,
    ),
    execution: nextExecution,
    cursorApiToken: String(setupRow?.cursorApiToken ?? "").trim(),
    execReadinessOk: execReadiness.ok,
    execContext: execReadiness.context,
    previousCodeTaskId: codeTaskIdEarly || runForVerify?.codeTaskId || null,
    previousCommitSha:
      runForVerify?.commitSha ?? runForVerify?.branchHeadCommitSha ?? nextExecution.commitSha ?? null,
    nowIso,
  });

  const orchestrationPatch = continuation.orchestrationPatch;
  const continuationDispatchedOnServer = continuation.continuationDispatchedOnServer;

  return {
    kind: "ok",
    verify,
    execution: nextExecution,
    orchestrationPatch,
    advance: { ...advance, orchestrationPatch },
    continuationDispatchedOnServer,
    repaired: verifyRepairMeta.repaired,
    resolvedBranch: verifyRepairMeta.resolvedBranch,
    manualVerifyStatus: mapManualGithubVerifyApiStatus({
      verify,
      execution: nextExecution,
      stateSyncFailed: stateSync.stateSyncFailed,
    }),
  };
}
