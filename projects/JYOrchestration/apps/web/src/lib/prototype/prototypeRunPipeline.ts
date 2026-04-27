/**
 * 프로토타입 전용 오케스트레이션 — Stage1/ENV_TEST 파이프라인을 import 하지 않습니다.
 */

import { launchCursorAgent, pollCursorAgent, type ExecutionSetupRelaySlice } from "@/lib/execution/cursorExecutionAdapter";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";
import {
  createPrototypeRun,
  getPrototypeRunById,
  markFailed,
  updatePrototypeRunStatus,
} from "@/lib/prototype/prototypeRunService";
import { reviewPrototypeCommit } from "@/lib/prototype/prototypeAiReviewService";
import type { PrototypeRun, PrototypeRunStatusReason } from "@/lib/prototype/prototypeRunTypes";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { prisma } from "@/lib/prisma";

export type PrototypeAutomationGate = Readonly<{
  automationAvailable: boolean;
  blockReason: PrototypeRunStatusReason | null;
}>;

function isTerminalAgentSuccess(status: string): boolean {
  const s = status.toUpperCase();
  return s === "FINISHED" || s === "COMPLETED" || s === "DONE";
}

function isTerminalAgentFailure(status: string): boolean {
  const s = status.toUpperCase();
  return s === "FAILED" || s === "ERROR" || s === "CANCELLED" || s === "CANCELED" || s === "STOPPED";
}

export async function evaluatePrototypeCursorAutomation(projectId: string): Promise<PrototypeAutomationGate> {
  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId } }),
  );
  if (!setup) {
    return { automationAvailable: false, blockReason: "EXECUTION_SETUP_INVALID" };
  }
  if (String(setup.status) !== "validated") {
    return { automationAvailable: false, blockReason: "EXECUTION_SETUP_INVALID" };
  }
  if (process.env.EXECUTION_LOOP_STUB_CURSOR === "1") {
    return { automationAvailable: false, blockReason: "STUB_CURSOR_ENABLED" };
  }
  if (!String(setup.cursorApiToken ?? "").trim()) {
    return { automationAvailable: false, blockReason: "CURSOR_API_NOT_CONNECTED" };
  }
  if (!String(setup.gitRepoUrl ?? "").trim() || !String(setup.baseBranch ?? "").trim()) {
    return { automationAvailable: false, blockReason: "EXECUTION_SETUP_INVALID" };
  }
  return { automationAvailable: true, blockReason: null };
}

function toRelaySlice(setup: {
  cursorApiUrl: string;
  cursorApiToken: string | null;
  gitRepoUrl: string;
  baseBranch: string;
  branchStrategy: string;
  branchPrefix: string | null;
  autoCommit: boolean;
  autoPush: boolean;
  autoPr: boolean;
  requireTestsBeforePush: boolean;
}): ExecutionSetupRelaySlice {
  return {
    cursorApiUrl: setup.cursorApiUrl,
    cursorApiToken: setup.cursorApiToken,
    gitRepoUrl: setup.gitRepoUrl.trim(),
    baseBranch: setup.baseBranch.trim(),
    branchStrategy: setup.branchStrategy,
    branchPrefix: setup.branchPrefix ?? null,
    autoCommit: setup.autoCommit,
    autoPush: setup.autoPush,
    autoPr: setup.autoPr,
    requireTestsBeforePush: setup.requireTestsBeforePush,
  };
}

/**
 * 신규 PrototypeRun 생성 후 수동/자동 분기까지 수행합니다.
 */
export async function orchestrateNewPrototypeRun(input: {
  readonly projectId: string;
  readonly projectName: string;
  readonly selectedTemplate: string;
  readonly promptSnapshot: string;
  /** true: Cursor Cloud Agent API 로 에이전트 시작 시도. false: 프롬프트 준비 상태만 기록. */
  readonly startCursorAgent: boolean;
}): Promise<{
  readonly run: PrototypeRun;
  readonly automationAvailable: boolean;
  readonly automationBlockReason: PrototypeRunStatusReason | null;
  readonly message?: string;
}> {
  const gate = await evaluatePrototypeCursorAutomation(input.projectId);
  let run = createPrototypeRun({
    projectId: input.projectId,
    projectName: input.projectName,
    selectedTemplate: input.selectedTemplate,
    promptSnapshot: input.promptSnapshot,
    initialStatus: "DRAFT",
    statusReason: null,
  });

  if (!input.startCursorAgent) {
    run =
      updatePrototypeRunStatus(input.projectId, run.id, {
        status: "PROMPT_READY",
        statusReason: "MANUAL_CURSOR_EXECUTION_REQUIRED",
      }) ?? run;
    logPrototypePipelineEvent("prototype_prompt_ready", { projectId: input.projectId, runId: run.id });
    return {
      run,
      automationAvailable: gate.automationAvailable,
      automationBlockReason: gate.blockReason,
      message: "프롬프트를 복사해 Cursor에 붙여넣은 뒤, 완료되면 결과 URL을 연결하세요.",
    };
  }

  if (!gate.automationAvailable) {
    run =
      updatePrototypeRunStatus(input.projectId, run.id, {
        status: "PROMPT_READY",
        statusReason: gate.blockReason ?? "MANUAL_CURSOR_EXECUTION_REQUIRED",
      }) ?? run;
    logPrototypePipelineEvent("prototype_prompt_ready", {
      projectId: input.projectId,
      runId: run.id,
      reason: gate.blockReason,
    });
    return {
      run,
      automationAvailable: false,
      automationBlockReason: gate.blockReason,
      message: "Cursor API 자동 실행을 사용할 수 없습니다. 수동으로 프롬프트를 실행하세요.",
    };
  }

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId: input.projectId } }),
  );
  if (!setup) {
    const r = markFailed(input.projectId, run.id, "EXECUTION_SETUP_INVALID", "Execution setup 없음") ?? run;
    return { run: r, automationAvailable: false, automationBlockReason: "EXECUTION_SETUP_INVALID" };
  }

  const relay = toRelaySlice(setup);
  const launch = await launchCursorAgent({
    projectId: input.projectId,
    workflowId: null,
    executionSetup: relay,
    task: {
      id: `prototype:${run.id}`,
      title: "Prototype generation (workspace)",
      description: `Template: ${input.selectedTemplate}`,
      acceptanceCriteria: [],
    },
    suggestedBranchName: run.branchName,
    prompt: input.promptSnapshot,
    allowedPaths: undefined,
  });

  if (!launch.ok) {
    const r = markFailed(input.projectId, run.id, "CURSOR_LAUNCH_FAILED", launch.error) ?? run;
    return {
      run: r,
      automationAvailable: true,
      automationBlockReason: null,
      message: launch.error,
    };
  }

  run =
    updatePrototypeRunStatus(input.projectId, run.id, {
      status: "CURSOR_REQUESTED",
      cursorRunId: launch.agentId,
      statusReason: null,
    }) ?? run;
  logPrototypePipelineEvent("prototype_cursor_requested", {
    projectId: input.projectId,
    runId: run.id,
    cursorRunId: launch.agentId,
  });
  return {
    run,
    automationAvailable: true,
    automationBlockReason: null,
    message: "Cursor 에이전트가 시작되었습니다. 상태 새로고침으로 진행을 확인하세요.",
  };
}

/**
 * 에이전트 한 번 폴링 후 커밋 메타가 있으면 COMMIT_DETECTED 로 올립니다. AI 검토는 플레이스홀더입니다.
 */
export async function refreshPrototypeRunFromCursor(projectId: string, runId: string): Promise<PrototypeRun | null> {
  const gate = await evaluatePrototypeCursorAutomation(projectId);
  if (!gate.automationAvailable) return null;

  const run = getPrototypeRunById(projectId, runId);
  if (!run?.cursorRunId) return run;

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId } }),
  );
  const token = setup?.cursorApiToken?.trim();
  if (!setup || !token) return run;

  const polled = await pollCursorAgent({
    cursorApiUrl: setup.cursorApiUrl,
    cursorApiToken: token,
    agentId: run.cursorRunId,
    fallbackBranchName: run.branchName,
  });
  if (!polled.ok) {
    return markFailed(projectId, runId, "CURSOR_POLL_FAILED", polled.error) ?? run;
  }

  let next = run;
  if (isTerminalAgentFailure(polled.statusUpper)) {
    next = markFailed(projectId, runId, "CURSOR_POLL_FAILED", `Agent status ${polled.statusUpper}`) ?? run;
    return next;
  }

  if (polled.hints.commitHash) {
    const withCommit =
      updatePrototypeRunStatus(projectId, runId, {
        status: "COMMIT_DETECTED",
        commitSha: polled.hints.commitHash,
        changedFiles: polled.hints.changedFiles ?? [],
      }) ?? run;
    logPrototypePipelineEvent("prototype_commit_detected", { projectId, runId, commitSha: polled.hints.commitHash });
    logPrototypePipelineEvent("prototype_ai_review_started", { projectId, runId });
    const review = await reviewPrototypeCommit({
      run: withCommit,
      changedFiles: polled.hints.changedFiles ?? [],
      commitSha: polled.hints.commitHash,
    });
    if (review.decision === "NOT_IMPLEMENTED") {
      return (
        updatePrototypeRunStatus(projectId, runId, {
          status: "AI_REVIEWING",
          aiReviewDecision: "NOT_IMPLEMENTED",
          aiReviewSummary: review.summary,
        }) ?? withCommit
      );
    }
    return withCommit;
  }

  if (isTerminalAgentSuccess(polled.statusUpper)) {
    next =
      updatePrototypeRunStatus(projectId, runId, {
        status: "CURSOR_RUNNING",
        changedFiles: polled.hints.changedFiles ?? [],
      }) ?? run;
    return next;
  }

  next = updatePrototypeRunStatus(projectId, runId, { status: "CURSOR_RUNNING" }) ?? run;
  return next;
}
