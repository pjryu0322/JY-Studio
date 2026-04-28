/**
 * Stage2: PR_OPENED → reviewer → security → SCM → merge/verify (GitHub source of truth; no Cursor terminal wait).
 */
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { logStage2CatalogEvent } from "@/lib/service/envTestStage2CatalogEvents";
import {
  buildEnvTestStage2ReviewRequest,
  buildEnvTestStage2SecurityRequest,
  buildEnvTestStage2ScmRequest,
  buildPlatformToExecutorEnvTestStage2Stub,
  mergeEnvTestStage2RunValidationOutput,
  scmResultFromMergeOk,
} from "@/lib/service/envTestStage2PlatformActors";
import { getAiMemberByRole } from "@/lib/service/envTestStage2AiMemberLookup";
import {
  runEnvTestStage2ReviewerWithAiMember,
  runEnvTestStage2SecurityWithAiMember,
  runEnvTestStage2ScmDecisionWithAiMembers,
} from "@/lib/service/envTestStage2AiRoleEvaluation";
import {
  logStage2TelemetryEvent,
  parseEnvTestStage2TimingFromValidationOutput,
  patchTaskExecutionRunStage2Timing,
} from "@/lib/service/envTestStage2Telemetry";
import {
  monitorScmDone,
  monitorScmStart,
  monitorSecurityDone,
  monitorSecurityStart,
  monitorReviewDone,
  monitorReviewStart,
  patchTaskExecutionRunStage2RuntimeMonitor,
} from "@/lib/service/envTestStage2RuntimeMonitor";
import { ENV_TEST_STAGE2_RUN_META_KEY } from "@/lib/service/envTestStage2Messages";
import {
  ENV_TEST_ROLE_SEP_SCM_APPROVED_MERGE_PENDING_SUMMARY,
  ENV_TEST_ROLE_SEP_SCM_DECISION_MERGE_NOT_APPROVED_DEFAULT_SUMMARY,
  ENV_TEST_ROLE_SEP_SCM_MISSING_REPO_BRANCH_SUMMARY,
  ENV_TEST_ROLE_SEP_SCM_PLATFORM_FALLBACK_MERGE_PENDING_SUMMARY,
  ENV_TEST_ROLE_SEP_SCM_PLATFORM_FALLBACK_PROGRESS_LOG,
  formatEnvTestRoleSepReviewFailReturnMessage,
  formatEnvTestRoleSepScmDecisionBlockedReturnMessage,
  formatEnvTestRoleSepScmPreflightBlockedMessage,
  formatEnvTestRoleSepSecurityFailReturnMessage,
} from "@/lib/service/envTestUserFacingMessages";
import { executeEnvTestPrMergeSmokeTest } from "@/lib/service/environmentTestMergeService";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { appendStage2ProgressPhase, STAGE2_PROGRESS_PHASE } from "@/lib/executionLoop/stage2/stage2CanonicalProgressPhases";
export async function runEnvTestStage2ReviewScmAfterPrOpened(input: {
  projectId: string;
  taskId: string;
  execRunId: string;
  actorUserId: string;
  prNumber: number;
}): Promise<Awaited<ReturnType<typeof executeEnvTestPrMergeSmokeTest>>> {
  const runRow = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { changedFiles: true, gitSummary: true, validationOutput: true, branchName: true },
  });
  const rawCf = runRow?.changedFiles;
  const changedFiles = Array.isArray(rawCf) ? rawCf.map((x) => String(x)) : [];
  const diffSummary = String(runRow?.gitSummary ?? "").trim() || "(no summary)";

  const taskRow = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { name: true, description: true, lastOrchestrationBranch: true },
  });

  const proj = await withExecutionSetupSchemaHealRetry(() =>
    prisma.project.findUnique({
      where: { id: input.projectId },
      select: {
        executionSetup: {
          select: { gitRepoUrl: true, baseBranch: true },
        },
      },
    })
  );
  const repoUrl = String(proj?.executionSetup?.gitRepoUrl ?? "").trim();
  const baseBranch = String(proj?.executionSetup?.baseBranch ?? "").trim();
  const headBranch = String(runRow?.branchName ?? taskRow?.lastOrchestrationBranch ?? "").trim();

  const { platformToExecutor } = buildPlatformToExecutorEnvTestStage2Stub();
  const executorMember = await getAiMemberByRole({ projectId: input.projectId, role: "executor" });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_platform_to_executor",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: platformToExecutor, executorMember },
  });

  await prisma.task.update({
    where: { id: input.taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_PENDING },
  });
  await refreshWorkflowStates(input.projectId);

  const reviewRequest = buildEnvTestStage2ReviewRequest({
    requestedIntent: "ENV_TEST role_separation smoke",
    changedFiles,
    diffSummary,
  });
  let vOut = mergeEnvTestStage2RunValidationOutput(runRow?.validationOutput, { reviewRequest });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  const reviewerMember = await getAiMemberByRole({ projectId: input.projectId, role: "reviewer" });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_platform_to_reviewer",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: reviewRequest, reviewerMember },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_review_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { executionId: input.execRunId },
  });
  appendStage2ProgressPhase(STAGE2_PROGRESS_PHASE.REVIEWER_STARTED, {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    executionId: input.execRunId,
  });
  logStage2CatalogEvent({
    phase: "review_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorReviewStart(m, Date.now()));

  const reviewStarted = Date.now();
  const reviewStartIso = new Date(reviewStarted).toISOString();
  const reviewResult = await runEnvTestStage2ReviewerWithAiMember({
    projectId: input.projectId,
    request: reviewRequest,
  });
  const reviewEnded = Date.now();
  const reviewMs = reviewEnded - reviewStarted;
  await patchTaskExecutionRunStage2Timing(input.execRunId, { reviewTimeMs: reviewMs });
  logStage2TelemetryEvent({
    executionId: input.execRunId,
    stage: "REVIEWER",
    event: "REVIEW_COMPLETED",
    startTime: reviewStartIso,
    endTime: new Date(reviewEnded).toISOString(),
    elapsedMs: reviewMs,
    result: reviewResult.result,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
  });
  logStage2CatalogEvent({
    phase: "review_finished",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    elapsedMs: reviewMs,
    detail: { result: reviewResult.result },
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorReviewDone(m, Date.now()));
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { reviewResult });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_reviewer_to_platform",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: reviewResult },
  });

  const reviewPhase =
    reviewResult.result === "PASS"
      ? "env_test_stage2_review_passed"
      : reviewResult.result === "FAIL"
        ? "env_test_stage2_review_failed"
        : reviewResult.result === "MISSING"
          ? "env_test_stage2_review_missing"
          : "env_test_stage2_review_disabled";
  appendTaskProgressLog({
    kind: "execution",
    phase: reviewPhase,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { result: reviewResult.result, reason: reviewResult.reason.slice(0, 500) },
  });
  logStage2CatalogEvent({
    phase:
      reviewResult.result === "PASS"
        ? "review_passed"
        : reviewResult.result === "FAIL"
          ? "review_failed"
          : reviewResult.result === "MISSING"
            ? "review_missing"
            : "review_disabled",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    detail: { result: reviewResult.result, reason: reviewResult.reason.slice(0, 500) },
  });

  if (reviewResult.result === "FAIL") {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_REJECTED,
        status: "FAILED",
        lastEvalResult: "review_failed",
        lastEvalSummary: reviewResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
    vOut = mergeEnvTestStage2RunValidationOutput(vOut, {
      stage2RunSummary: { finalOutcome: "FAILED", reviewOutcome: reviewResult.result },
    });
    await prisma.taskExecutionRun.update({
      where: { id: input.execRunId },
      data: { validationOutput: vOut },
    });
    logStage2CatalogEvent({
      phase: "stage2_failed",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { step: "review", result: "FAIL" },
    });
    return {
      ok: false,
      message: formatEnvTestRoleSepReviewFailReturnMessage(reviewResult.reason),
      blockedReason: "REVIEW_FAILED",
    };
  }

  if (reviewResult.result === "PASS") {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_APPROVED,
        lastEvalResult: "review_passed",
        lastEvalSummary: reviewResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
  } else {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.SECURITY_PENDING,
        lastEvalResult: reviewResult.result === "MISSING" ? "review_missing" : "review_disabled",
        lastEvalSummary: reviewResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
  }

  await prisma.task.update({
    where: { id: input.taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.SECURITY_PENDING },
  });
  await refreshWorkflowStates(input.projectId);

  const securityRequest = buildEnvTestStage2SecurityRequest({ changedFiles, diffSummary });
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { securityRequest });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  const securityMember = await getAiMemberByRole({ projectId: input.projectId, role: "security" });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_platform_to_security",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: securityRequest, securityMember },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_security_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { executionId: input.execRunId },
  });
  appendStage2ProgressPhase(STAGE2_PROGRESS_PHASE.SECURITY_STARTED, {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    executionId: input.execRunId,
  });
  logStage2CatalogEvent({
    phase: "security_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorSecurityStart(m, Date.now()));

  const secStarted = Date.now();
  const secStartIso = new Date(secStarted).toISOString();
  const securityResult = await runEnvTestStage2SecurityWithAiMember({
    projectId: input.projectId,
    request: securityRequest,
  });
  const secEnded = Date.now();
  const secMs = secEnded - secStarted;
  await patchTaskExecutionRunStage2Timing(input.execRunId, { securityTimeMs: secMs });
  logStage2TelemetryEvent({
    executionId: input.execRunId,
    stage: "SECURITY",
    event: "SECURITY_COMPLETED",
    startTime: secStartIso,
    endTime: new Date(secEnded).toISOString(),
    elapsedMs: secMs,
    result: securityResult.result,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
  });
  logStage2CatalogEvent({
    phase: "security_finished",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    elapsedMs: secMs,
    detail: { result: securityResult.result },
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorSecurityDone(m, Date.now()));
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { securityResult });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_security_to_platform",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: securityResult },
  });

  const secPhase =
    securityResult.result === "PASS"
      ? "env_test_stage2_security_passed"
      : securityResult.result === "FAIL"
        ? "env_test_stage2_security_failed"
        : securityResult.result === "MISSING"
          ? "env_test_stage2_security_missing"
          : "env_test_stage2_security_disabled";
  appendTaskProgressLog({
    kind: "execution",
    phase: secPhase,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { result: securityResult.result, reason: securityResult.reason.slice(0, 500) },
  });
  logStage2CatalogEvent({
    phase:
      securityResult.result === "PASS"
        ? "security_passed"
        : securityResult.result === "FAIL"
          ? "security_failed"
          : securityResult.result === "MISSING"
            ? "security_missing"
            : "security_disabled",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    detail: { result: securityResult.result, reason: securityResult.reason.slice(0, 500) },
  });

  if (securityResult.result === "FAIL") {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.SECURITY_FAILED,
        status: "FAILED",
        lastEvalResult: "security_failed",
        lastEvalSummary: securityResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
    vOut = mergeEnvTestStage2RunValidationOutput(vOut, {
      stage2RunSummary: {
        finalOutcome: "FAILED",
        reviewOutcome: reviewResult.result,
        securityOutcome: securityResult.result,
      },
    });
    await prisma.taskExecutionRun.update({
      where: { id: input.execRunId },
      data: { validationOutput: vOut },
    });
    logStage2CatalogEvent({
      phase: "stage2_failed",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { step: "security", result: "FAIL" },
    });
    return {
      ok: false,
      message: formatEnvTestRoleSepSecurityFailReturnMessage(securityResult.reason),
      blockedReason: "SECURITY_FAILED",
    };
  }

  if (securityResult.result === "PASS") {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.SECURITY_PASSED,
        lastEvalResult: "security_passed",
        lastEvalSummary: securityResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
  } else {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.SCM_PENDING,
        lastEvalResult: securityResult.result === "MISSING" ? "security_missing" : "security_disabled",
        lastEvalSummary: securityResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
  }

  await prisma.task.update({
    where: { id: input.taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.SCM_PENDING },
  });
  await refreshWorkflowStates(input.projectId);

  const scmMember = await getAiMemberByRole({ projectId: input.projectId, role: "scm" });
  const scmRequest = buildEnvTestStage2ScmRequest({
    prNumber: input.prNumber,
    prStateOpen: true,
    review: reviewResult,
    security: securityResult,
  });
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { scmRequest });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_platform_to_scm",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: scmRequest, scmMember },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_scm_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { executionId: input.execRunId, scmMemberAvailable: scmMember.available },
  });
  appendStage2ProgressPhase(STAGE2_PROGRESS_PHASE.SCM_STARTED, {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    executionId: input.execRunId,
    detail: { scmMemberAvailable: scmMember.available },
  });
  logStage2CatalogEvent({
    phase: "scm_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    detail: { scmMemberAvailable: scmMember.available },
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmStart(m, Date.now()));

  let mergeRes: Awaited<ReturnType<typeof executeEnvTestPrMergeSmokeTest>>;

  if (!scmMember.available) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_scm_platform_fallback",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: { message: ENV_TEST_ROLE_SEP_SCM_PLATFORM_FALLBACK_PROGRESS_LOG },
    });
    logStage2CatalogEvent({
      phase: "scm_platform_fallback",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { platform_fallback: true },
    });
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING,
        lastEvalResult: "merge_pending",
        lastEvalSummary: ENV_TEST_ROLE_SEP_SCM_PLATFORM_FALLBACK_MERGE_PENDING_SUMMARY,
      },
    });
    await refreshWorkflowStates(input.projectId);

    await patchTaskExecutionRunStage2Timing(input.execRunId, { scmTimeMs: 0 });
    const mergeStarted = Date.now();
    const mergeStartIso = new Date(mergeStarted).toISOString();
    mergeRes = await executeEnvTestPrMergeSmokeTest({
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      taskId: input.taskId,
    });
    const mergeEnded = Date.now();
    const mergePipelineMs = mergeEnded - mergeStarted;
    await patchTaskExecutionRunStage2Timing(input.execRunId, {
      mergeTimeMs: mergePipelineMs,
      mergeVerifyTimeMs: 0,
    });
    logStage2TelemetryEvent({
      executionId: input.execRunId,
      stage: "MERGE",
      event: "MERGE_PIPELINE_COMPLETED",
      startTime: mergeStartIso,
      endTime: new Date(mergeEnded).toISOString(),
      elapsedMs: mergePipelineMs,
      result: mergeRes.ok ? "ok" : "fail",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
    });
  } else {
    if (!repoUrl || !baseBranch || !headBranch || !taskRow?.name) {
      vOut = mergeEnvTestStage2RunValidationOutput(vOut, {
        stage2RunSummary: {
          finalOutcome: "FAILED",
          reviewOutcome: reviewResult.result,
          securityOutcome: securityResult.result,
          scmParticipant: "AI",
          scmMergeResult: "BLOCKED",
          mergeVerified: false,
        },
      });
      await prisma.taskExecutionRun.update({
        where: { id: input.execRunId },
        data: { validationOutput: vOut },
      });
      await prisma.task.update({
        where: { id: input.taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_BLOCKED,
          status: "FAILED",
          lastEvalResult: "scm_blocked",
          lastEvalSummary: ENV_TEST_ROLE_SEP_SCM_MISSING_REPO_BRANCH_SUMMARY,
        },
      });
      await refreshWorkflowStates(input.projectId);
      logStage2CatalogEvent({
        phase: "stage2_failed",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        executionId: input.execRunId,
        detail: { step: "scm_preflight", reason: "missing_repo_branch" },
      });
      await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmDone(m, Date.now()));
      return { ok: false, message: formatEnvTestRoleSepScmPreflightBlockedMessage(), blockedReason: "SCM_BLOCKED" };
    }

    const scmDecStarted = Date.now();
    const scmDecStartIso = new Date(scmDecStarted).toISOString();
    const scmDecision = await runEnvTestStage2ScmDecisionWithAiMembers({
      projectId: input.projectId,
      repoUrl,
      taskId: input.taskId,
      taskTitle: taskRow.name,
      taskDescription: taskRow.description ?? null,
      branch: headBranch,
      baseBranch,
      reviewResult: reviewResult.result,
      securityResult: securityResult.result,
      reviewReason: reviewResult.reason,
      securityReason: securityResult.reason,
    });
    const scmDecisionMs = Date.now() - scmDecStarted;
    await patchTaskExecutionRunStage2Timing(input.execRunId, { scmTimeMs: scmDecisionMs });
    logStage2TelemetryEvent({
      executionId: input.execRunId,
      stage: "SCM",
      event: "SCM_DECISION_COMPLETED",
      startTime: scmDecStartIso,
      endTime: new Date().toISOString(),
      elapsedMs: scmDecisionMs,
      result: scmDecision.decision ?? "n/a",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
    });

    if (scmDecision.decision && scmDecision.decision !== "approve_merge") {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_stage2_scm_blocked",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        detail: { decision: scmDecision.decision, summary: (scmDecision.summary ?? "").slice(0, 500) },
      });
      logStage2CatalogEvent({
        phase: "scm_blocked",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        executionId: input.execRunId,
        detail: { decision: scmDecision.decision },
      });
      vOut = mergeEnvTestStage2RunValidationOutput(vOut, {
        stage2RunSummary: {
          finalOutcome: "FAILED",
          reviewOutcome: reviewResult.result,
          securityOutcome: securityResult.result,
          scmParticipant: "AI",
          scmMergeResult: "BLOCKED",
          mergeVerified: false,
        },
      });
      await prisma.taskExecutionRun.update({
        where: { id: input.execRunId },
        data: { validationOutput: vOut },
      });
      await prisma.task.update({
        where: { id: input.taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_BLOCKED,
          status: "FAILED",
          lastEvalResult: "scm_blocked",
          lastEvalSummary: (
            scmDecision.summary ?? ENV_TEST_ROLE_SEP_SCM_DECISION_MERGE_NOT_APPROVED_DEFAULT_SUMMARY
          ).slice(0, 1500),
        },
      });
      await refreshWorkflowStates(input.projectId);
      logStage2CatalogEvent({
        phase: "stage2_failed",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        executionId: input.execRunId,
        detail: { step: "scm_decision", blockedReason: "SCM_BLOCKED" },
      });
      await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmDone(m, Date.now()));
      return {
        ok: false,
        message: formatEnvTestRoleSepScmDecisionBlockedReturnMessage(scmDecision.summary ?? ""),
        blockedReason: "SCM_BLOCKED",
      };
    }

    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING,
        lastEvalResult: "merge_pending",
        lastEvalSummary: ENV_TEST_ROLE_SEP_SCM_APPROVED_MERGE_PENDING_SUMMARY,
      },
    });
    await refreshWorkflowStates(input.projectId);

    const mergeStarted = Date.now();
    const mergeStartIso = new Date(mergeStarted).toISOString();
    mergeRes = await executeEnvTestPrMergeSmokeTest({
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      taskId: input.taskId,
    });
    const mergeEnded = Date.now();
    const mergePipelineMs = mergeEnded - mergeStarted;
    await patchTaskExecutionRunStage2Timing(input.execRunId, {
      mergeTimeMs: mergePipelineMs,
      mergeVerifyTimeMs: 0,
    });
    logStage2TelemetryEvent({
      executionId: input.execRunId,
      stage: "MERGE",
      event: "MERGE_PIPELINE_COMPLETED",
      startTime: mergeStartIso,
      endTime: new Date(mergeEnded).toISOString(),
      elapsedMs: mergePipelineMs,
      result: mergeRes.ok ? "ok" : "fail",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
    });
  }

  const scmResult = scmResultFromMergeOk(
    mergeRes.ok,
    !mergeRes.ok && "blockedReason" in mergeRes ? mergeRes.blockedReason : undefined,
    { platformScmFallback: !scmMember.available }
  );
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { scmResult });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_scm_to_platform",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: scmResult },
  });

  await patchTaskExecutionRunStage2Timing(input.execRunId, {
    pipelineFinishedAtMs: Date.now(),
  });

  const runFresh = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { validationOutput: true },
  });
  const voFresh = runFresh?.validationOutput ?? vOut;
  const timing = parseEnvTestStage2TimingFromValidationOutput(voFresh);
  const finalOutcome = !mergeRes.ok
    ? "FAILED"
    : reviewResult.result === "PASS" && securityResult.result === "PASS" && scmMember.available
      ? "COMPLETED"
      : "PARTIAL";
  const executorFromMeta = (() => {
    try {
      const j = JSON.parse(String(voFresh ?? "{}")) as Record<string, unknown>;
      const m = j[ENV_TEST_STAGE2_RUN_META_KEY] as Record<string, unknown> | undefined;
      const e = m?.executorAck as { result?: string } | undefined;
      return e?.result === "PASS" || e?.result === "FAIL" ? (e.result as "PASS" | "FAIL") : undefined;
    } catch {
      return undefined;
    }
  })();
  const scmMergeSummary =
    scmResult.result === "MERGED" ? "MERGED" : scmResult.result === "VERIFY_FAILED" ? "VERIFY_FAILED" : "BLOCKED";
  const nextVo = mergeEnvTestStage2RunValidationOutput(voFresh, {
    stage2RunSummary: {
      executorResult: executorFromMeta,
      reviewOutcome: reviewResult.result,
      securityOutcome: securityResult.result,
      scmParticipant: scmMember.available ? "AI" : "PLATFORM",
      scmMergeResult: scmMergeSummary,
      finalOutcome,
      mergeVerified: mergeRes.ok,
    },
  });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: nextVo },
  });

  if (mergeRes.ok) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_scm_merged",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: { platformScmFallback: !scmMember.available },
    });
    appendStage2ProgressPhase(STAGE2_PROGRESS_PHASE.MERGE_COMPLETED, {
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      executionId: input.execRunId,
      detail: { platformScmFallback: !scmMember.available, finalOutcome },
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_merge_verified",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: { ok: true },
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_total_elapsed_ms",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: {
        total_elapsed_ms: timing.totalTimeMs,
        bottleneck_top1: timing.topBottleneck,
      },
    });
    logStage2CatalogEvent({
      phase: "scm_merged",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { platformScmFallback: !scmMember.available },
    });
    logStage2CatalogEvent({
      phase: "merge_verified",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { ok: true },
    });
    const completionPhase =
      finalOutcome === "COMPLETED"
        ? "stage2_completed"
        : finalOutcome === "PARTIAL"
          ? "stage2_partial"
          : "stage2_failed";
    logStage2CatalogEvent({
      phase: completionPhase,
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: {
        finalOutcome,
        total_elapsed_ms: timing.totalTimeMs,
        bottleneck_top1: timing.topBottleneck,
      },
    });
    logStage2CatalogEvent({
      phase: "scm_finished",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { mergeOk: mergeRes.ok, finalOutcome },
    });
    logStage2CatalogEvent({
      phase: "total_elapsed_ms",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      elapsedMs: typeof timing.totalTimeMs === "number" ? timing.totalTimeMs : undefined,
      detail: {
        total_elapsed_ms: timing.totalTimeMs,
        executorTime: timing.breakdown?.["executor"],
        cursorTime: timing.breakdown?.["cursor"],
        branchDetectTime: timing.breakdown?.["branchDetect"],
        prCreationTime: timing.breakdown?.["prCreation"],
        reviewTime: timing.breakdown?.["review"],
        securityTime: timing.breakdown?.["security"],
        scmTime: timing.breakdown?.["scm"],
        mergeTime: timing.breakdown?.["merge"],
        mergeVerifyTime: timing.breakdown?.["mergeVerify"],
        bottleneckTop1: timing.topBottleneck,
      },
    });
    appendStage2ProgressPhase(STAGE2_PROGRESS_PHASE.FINISHED, {
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      executionId: input.execRunId,
      detail: { finalOutcome, total_elapsed_ms: timing.totalTimeMs },
    });
    await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmDone(m, Date.now()));
  } else {
    if (scmResult.result === "VERIFY_FAILED") {
      logStage2CatalogEvent({
        phase: "scm_verify_failed",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        executionId: input.execRunId,
        detail: { scmResult: scmResult.result },
      });
    }
    logStage2CatalogEvent({
      phase: "stage2_failed",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { mergeOk: false, scmResult: scmResult.result },
    });
    await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmDone(m, Date.now()));
  }

  return mergeRes;
}
