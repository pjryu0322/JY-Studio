/**
 * 프로토타입 전용 오케스트레이션 — Stage1/ENV_TEST 파이프라인을 import 하지 않습니다.
 */

import { pollCursorAgent, type ExecutionSetupRelaySlice } from "@/lib/execution/cursorExecutionAdapter";
import { requestCursorPrototypeRun } from "@/lib/prototype/prototypeCursorAdapter";
import { refreshPrototypeGitState } from "@/lib/prototype/prototypeGitMonitor";
import { reviewPrototypeRun } from "@/lib/prototype/prototypeAiReview";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";
import {
  createRun,
  getRun,
  markFailed,
  updateRun,
} from "@/lib/prototype/prototypeRunStore";
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

/**
 * 신규 PrototypeRun: 기본 PROMPT_READY. 자동화 가능하면 Cursor 요청까지 진행.
 */
export async function orchestrateNewPrototypeRun(input: {
  readonly projectId: string;
  readonly projectName: string;
  readonly selectedTemplate: string;
  readonly promptSnapshot: string;
  readonly startCursorAgent: boolean;
}): Promise<{
  readonly run: PrototypeRun;
  readonly automationAvailable: boolean;
  readonly automationBlockReason: PrototypeRunStatusReason | null;
  readonly message?: string;
}> {
  const gate = await evaluatePrototypeCursorAutomation(input.projectId);
  let run = createRun({
    projectId: input.projectId,
    projectName: input.projectName,
    selectedTemplate: input.selectedTemplate,
    promptSnapshot: input.promptSnapshot,
    initialStatus: "PROMPT_READY",
    statusReason: input.startCursorAgent ? null : "MANUAL_CURSOR_EXECUTION_REQUIRED",
  });

  if (!input.startCursorAgent) {
    return {
      run,
      automationAvailable: gate.automationAvailable,
      automationBlockReason: gate.blockReason,
      message: "프롬프트를 복사해 Cursor에 붙여넣은 뒤, 완료되면 결과 URL을 연결하세요.",
    };
  }

  if (!gate.automationAvailable) {
    run =
      updateRun(input.projectId, run.id, {
        status: "PROMPT_READY",
        statusReason: gate.blockReason ?? "MANUAL_CURSOR_EXECUTION_REQUIRED",
      }) ?? run;
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
  const cursor = await requestCursorPrototypeRun({
    projectId: input.projectId,
    executionSetup: relay,
    runId: run.id,
    branchName: run.branchName,
    promptSnapshot: input.promptSnapshot,
    selectedTemplate: input.selectedTemplate,
  });

  if (!cursor.supported) {
    if (cursor.reason === "CURSOR_LAUNCH_FAILED") {
      const r = markFailed(input.projectId, run.id, "CURSOR_LAUNCH_FAILED", cursor.message) ?? run;
      return {
        run: r,
        automationAvailable: true,
        automationBlockReason: null,
        message: cursor.message,
      };
    }
    run =
      updateRun(input.projectId, run.id, {
        status: "PROMPT_READY",
        statusReason: "CURSOR_NOT_CONNECTED",
      }) ?? run;
    return {
      run,
      automationAvailable: true,
      automationBlockReason: null,
      message: cursor.message,
    };
  }

  run =
    updateRun(input.projectId, run.id, {
      status: "CURSOR_REQUESTED",
      cursorRunId: cursor.cursorRunId,
      statusReason: null,
    }) ?? run;
  logPrototypePipelineEvent("prototype_cursor_requested", {
    projectId: input.projectId,
    runId: run.id,
    cursorRunId: cursor.cursorRunId,
  });
  return {
    run,
    automationAvailable: true,
    automationBlockReason: null,
    message: "Cursor 에이전트가 시작되었습니다. 상태 새로고침으로 진행을 확인하세요.",
  };
}

/**
 * Cursor 폴링 + GitHub 브랜치 관측 + AI 검토(경계)까지 한 번에 시도합니다.
 */
export async function refreshPrototypeRunState(projectId: string, runId: string): Promise<PrototypeRun | null> {
  const gate = await evaluatePrototypeCursorAutomation(projectId);
  let run = getRun(projectId, runId);
  if (!run) return null;

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId } }),
  );
  const token = setup?.cursorApiToken?.trim();
  if (gate.automationAvailable && run.cursorRunId && setup && token) {
    const polled = await pollCursorAgent({
      cursorApiUrl: setup.cursorApiUrl,
      cursorApiToken: token,
      agentId: run.cursorRunId,
      fallbackBranchName: run.branchName,
    });
    if (!polled.ok) {
      run = markFailed(projectId, runId, "CURSOR_POLL_FAILED", polled.error) ?? run;
      return run;
    }
    if (isTerminalAgentFailure(polled.statusUpper)) {
      run = markFailed(projectId, runId, "CURSOR_POLL_FAILED", `Agent status ${polled.statusUpper}`) ?? run;
      return run;
    }
    if (polled.hints.commitHash) {
      run =
        updateRun(projectId, runId, {
          status: "COMMIT_DETECTED",
          commitSha: polled.hints.commitHash,
          changedFiles: polled.hints.changedFiles ?? [],
        }) ?? run;
      logPrototypePipelineEvent("prototype_commit_detected", { projectId, runId, commitSha: polled.hints.commitHash });
    } else if (isTerminalAgentSuccess(polled.statusUpper)) {
      run =
        updateRun(projectId, runId, {
          status: "CURSOR_RUNNING",
          changedFiles: polled.hints.changedFiles ?? [],
        }) ?? run;
    } else {
      run = updateRun(projectId, runId, { status: "CURSOR_RUNNING" }) ?? run;
    }
    run = getRun(projectId, runId) ?? run;
  }

  if (setup?.gitRepoUrl && setup.githubAccessToken !== undefined) {
    run = getRun(projectId, runId) ?? run;
    const git = await refreshPrototypeGitState(run, {
      projectId,
      repoUrl: setup.gitRepoUrl,
      baseBranch: setup.baseBranch,
      githubAccessToken: setup.githubAccessToken ?? null,
    });
    if (git.patch) {
      run = updateRun(projectId, runId, git.patch) ?? run;
      if (git.patch.status === "COMMIT_DETECTED") {
        logPrototypePipelineEvent("prototype_commit_detected", { projectId, runId, source: "github" });
      }
    }
  }

  run = getRun(projectId, runId) ?? run;
  run = getRun(projectId, runId) ?? run;
  if (run.status === "COMMIT_DETECTED") {
    logPrototypePipelineEvent("prototype_review_started", { projectId, runId, phase: "review" });
    const rev = await reviewPrototypeRun(run);
    if (rev.outcome === "REWORK_REQUIRED") {
      run =
        updateRun(projectId, runId, {
          status: "REWORK_REQUIRED",
          aiReviewDecision: "REWORK",
          aiReviewSummary: rev.summary,
        }) ?? run;
    } else if (rev.outcome === "PASS") {
      run = updateRun(projectId, runId, { status: "AI_REVIEWING", aiReviewDecision: "PASS" }) ?? run;
    } else if (rev.outcome === "BLOCKED") {
      const sr = rev.reason === "REVIEW_DATA_MISSING" ? "REVIEW_DATA_MISSING" : "REVIEW_ENGINE_NOT_READY";
      run = updateRun(projectId, runId, { status: "BLOCKED", statusReason: sr }) ?? run;
    }
  }

  return getRun(projectId, runId);
}

/** @deprecated refreshPrototypeRunState 사용 */
export async function refreshPrototypeRunFromCursor(projectId: string, runId: string): Promise<PrototypeRun | null> {
  return refreshPrototypeRunState(projectId, runId);
}
