/**
 * 프로토타입 전용 오케스트레이션 — Stage1/ENV_TEST 파이프라인을 import 하지 않습니다.
 * WorkUnit 순차 실행: Cursor → Git → 검토 → PR → Merge 반복.
 */

import { pollCursorAgent, type ExecutionSetupRelaySlice } from "@/lib/execution/cursorExecutionAdapter";
import { requestCursorPrototypeRun } from "@/lib/prototype/prototypeCursorAdapter";
import { refreshPrototypeGitStateForBranch } from "@/lib/prototype/prototypeGitMonitor";
import { reviewPrototypeWorkUnit } from "@/lib/prototype/prototypeAiReview";
import { openPrototypePr, mergePrototypePr } from "@/lib/prototype/prototypePrPipeline";
import { composeGithubPagesPreviewUrlFromRepoUrl } from "@/lib/prototype/githubPagesPreviewUrl";
import {
  ensureGithubPagesDeploySetupOnMain,
  findWorkflowRunForHeadSha,
  verifyGithubPagesUrlReachable,
} from "@/lib/prototype/prototypeGithubPagesDeployService";
import {
  planPrototypeWorkUnitsResolved,
  summarizeWorkUnitsForPlanner,
  workUnitProgressFromRun,
  type PlanPrototypeWorkUnitsInput,
} from "@/lib/prototype/prototypePlannerService";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";
import {
  createRun,
  getLatestRun,
  getRun,
  markFailed,
  markBlocked,
  updateRun,
} from "@/lib/prototype/prototypeRunStore";
import type { PrototypeRun, PrototypeRunStatusReason, PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { prisma } from "@/lib/prisma";

export type PrototypeAutomationGate = Readonly<{
  automationAvailable: boolean;
  blockReason: PrototypeRunStatusReason | null;
}>;

export type OrchestratePlannerContext = Readonly<{
  projectDescription: string;
  actorFlowSummary: string;
  featureDraftTitles: readonly string[];
  ideationSummary?: string;
}>;

function isTerminalPrototypeRunStatus(status: string): boolean {
  return (
    status === "PREVIEW_READY" ||
    status === "FAILED" ||
    status === "BLOCKED" ||
    status === "CANCELLED" ||
    status === "DEPLOY_FAILED"
  );
}

function isPromptOnlyStub(run: PrototypeRun): boolean {
  return (
    run.status === "PROMPT_READY" &&
    run.workUnits.length === 0 &&
    (run.statusReason === "MANUAL_CURSOR_EXECUTION_REQUIRED" || run.statusReason === null)
  );
}

function shouldDeferCursorLaunch(run: PrototypeRun): boolean {
  return run.runSchemaVersion >= 2 && run.workUnitsExecutionConfirmed !== true;
}

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

type PrototypePolicy = "manual_review" | "auto_pr" | "auto_merge";
function derivePrototypePolicyFromExecutionSetup(setup: {
  requireApprovalBeforeApply: boolean;
  autoPush: boolean;
  autoPr: boolean;
  stopOnOutOfScopeChange: boolean;
}): PrototypePolicy {
  if (setup.requireApprovalBeforeApply) return "manual_review";
  if (setup.autoPush && setup.autoPr) {
    return setup.stopOnOutOfScopeChange === false ? "auto_merge" : "auto_pr";
  }
  return "manual_review";
}

function replaceWorkUnit(units: readonly PrototypeWorkUnit[], id: string, patch: Partial<PrototypeWorkUnit>): PrototypeWorkUnit[] {
  return units.map((u) => (u.id === id ? { ...u, ...patch } : u));
}

function activeWorkUnit(run: PrototypeRun): PrototypeWorkUnit | null {
  const sorted = [...run.workUnits].sort((a, b) => a.order - b.order);
  return sorted.find((u) => u.status !== "MERGED" && u.status !== "FAILED") ?? null;
}

function allWorkUnitsMerged(run: PrototypeRun): boolean {
  if (!run.workUnits.length) return false;
  return run.workUnits.every((u) => u.status === "MERGED");
}

function inferPlannerInputFromRun(run: PrototypeRun, projectName: string): PlanPrototypeWorkUnitsInput {
  const snap = run.promptSnapshot;
  return {
    projectName: projectName.trim() || "프로젝트",
    projectDescription: snap.slice(0, 4000),
    ideationSummary: "",
    actorFlowSummary: "",
    selectedTemplate: run.selectedTemplate,
    featureDraftTitles: [] as readonly string[],
    promptSnapshot: snap,
    repositoryStructureHint:
      "Vite React 웹은 `web/package.json`, `web/vite.config.ts`, `web/index.html`, `web/src/**` 구조를 기본으로 가정합니다.",
    userFeedback: "",
    previousWorkUnitsSummary: "",
  };
}

export async function evaluatePrototypeCursorAutomation(projectId: string): Promise<PrototypeAutomationGate> {
  const setup = await withExecutionSetupSchemaHealRetry(() => prisma.executionSetup.findUnique({ where: { projectId } }));
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
 * 신규 PrototypeRun: PROMPT_READY부터 시작. 자동화 가능하면 LLM Planner → WorkUnit 미리보기(실행은 사용자 확인 후).
 */
export async function orchestrateNewPrototypeRun(input: {
  readonly projectId: string;
  readonly projectName: string;
  readonly selectedTemplate: string;
  readonly promptSnapshot: string;
  readonly startCursorAgent: boolean;
  readonly plannerContext?: OrchestratePlannerContext;
}): Promise<{
  readonly run: PrototypeRun;
  readonly automationAvailable: boolean;
  readonly automationBlockReason: PrototypeRunStatusReason | null;
  readonly message?: string;
}> {
  const gate = await evaluatePrototypeCursorAutomation(input.projectId);

  const latest = getLatestRun(input.projectId);
  if (latest && !isTerminalPrototypeRunStatus(latest.status)) {
    if (!input.startCursorAgent || !isPromptOnlyStub(latest)) {
      return {
        run: latest,
        automationAvailable: gate.automationAvailable,
        automationBlockReason: gate.blockReason,
        message: "현재 실행이 진행 중입니다.",
      };
    }
  }

  let run: PrototypeRun;
  if (latest && !isTerminalPrototypeRunStatus(latest.status) && input.startCursorAgent && isPromptOnlyStub(latest)) {
    run =
      updateRun(input.projectId, latest.id, {
        selectedTemplate: input.selectedTemplate,
        promptSnapshot: input.promptSnapshot,
        statusReason: null,
        runSchemaVersion: 2,
        workUnitsExecutionConfirmed: false,
        plannerSource: null,
        plannerSummary: null,
        workUnits: [],
        totalWorkUnits: 0,
        currentWorkUnitOrder: null,
        cursorRunId: null,
        commitSha: null,
        changedFiles: [],
        prUrl: null,
        prNumber: null,
        mergeSha: null,
        aiReviewDecision: null,
        aiReviewSummary: null,
      }) ?? latest;
  } else {
    run = createRun({
      projectId: input.projectId,
      projectName: input.projectName,
      selectedTemplate: input.selectedTemplate,
      promptSnapshot: input.promptSnapshot,
      initialStatus: "PROMPT_READY",
      statusReason: input.startCursorAgent ? null : "MANUAL_CURSOR_EXECUTION_REQUIRED",
    });
  }

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

  run =
    updateRun(input.projectId, run.id, {
      status: "PLANNER_ANALYZING",
      plannerStatus: "RUNNING",
      statusReason: null,
    }) ?? run;

  const ctx = input.plannerContext;
  const inferred = inferPlannerInputFromRun(run, input.projectName);
  const planIn: PlanPrototypeWorkUnitsInput = {
    projectName: input.projectName,
    projectDescription: ctx?.projectDescription ?? inferred.projectDescription,
    ideationSummary: ctx?.ideationSummary ?? inferred.ideationSummary,
    actorFlowSummary: ctx?.actorFlowSummary ?? inferred.actorFlowSummary,
    selectedTemplate: input.selectedTemplate,
    featureDraftTitles: ctx?.featureDraftTitles ?? inferred.featureDraftTitles,
    promptSnapshot: input.promptSnapshot,
    repositoryStructureHint: inferred.repositoryStructureHint,
    userFeedback: "",
    previousWorkUnitsSummary: "",
  };

  const plan = await planPrototypeWorkUnitsResolved(planIn, run.id);
  const plannerSummary =
    plan.plannerSource === "fallback"
      ? `WorkUnit ${plan.workUnits.length}개 생성 (AI 보조 모드)`
      : `WorkUnit ${plan.workUnits.length}개 생성`;

  run =
    updateRun(input.projectId, run.id, {
      status: "WORK_UNITS_READY",
      plannerStatus: "DONE",
      workUnits: plan.workUnits,
      plannerSource: plan.plannerSource,
      totalWorkUnits: plan.workUnits.length,
      currentWorkUnitOrder: plan.workUnits.length ? 1 : null,
      plannerSummary,
      workUnitsExecutionConfirmed: false,
    }) ?? run;

  const beforeLaunch = getRun(input.projectId, run.id);
  if (beforeLaunch?.status === "CANCEL_REQUESTED") {
    const stopped = updateRun(input.projectId, run.id, { status: "CANCELLED" }) ?? run;
    logPrototypePipelineEvent("prototype_cancelled", { projectId: input.projectId, runId: run.id });
    return { run: stopped, automationAvailable: gate.automationAvailable, automationBlockReason: gate.blockReason };
  }

  return {
    run,
    automationAvailable: true,
    automationBlockReason: null,
    message: "AI 기획자가 WorkUnit 계획을 생성했습니다. 미리보기에서 확인한 뒤 WorkUnit 실행을 시작하세요.",
  };
}

async function maybeRunPlanner(projectId: string, runId: string, projectName: string): Promise<PrototypeRun | null> {
  let run = getRun(projectId, runId);
  if (!run) return null;
  if (run.workUnits.length > 0) return run;
  if (run.status !== "PLANNER_ANALYZING") return run;

  run = updateRun(projectId, runId, { plannerStatus: "RUNNING" }) ?? run;

  const inferred = inferPlannerInputFromRun(run, projectName);
  const plan = await planPrototypeWorkUnitsResolved(inferred, run.id);
  const plannerSummary =
    plan.plannerSource === "fallback"
      ? `WorkUnit ${plan.workUnits.length}개 생성 (AI 보조 모드)`
      : `WorkUnit ${plan.workUnits.length}개 생성`;

  return (
    updateRun(projectId, runId, {
      status: "WORK_UNITS_READY",
      plannerStatus: "DONE",
      workUnits: plan.workUnits,
      plannerSource: plan.plannerSource,
      totalWorkUnits: plan.workUnits.length,
      currentWorkUnitOrder: plan.workUnits.length ? 1 : null,
      plannerSummary,
      workUnitsExecutionConfirmed: run.runSchemaVersion >= 2 ? false : true,
    }) ?? run
  );
}

async function advancePrototypePagesDeployPhase(
  projectId: string,
  runId: string,
  run: PrototypeRun,
  setup: Awaited<ReturnType<typeof prisma.executionSetup.findUnique>>,
): Promise<PrototypeRun | null> {
  if (!allWorkUnitsMerged(run)) return null;
  let r = getRun(projectId, runId) ?? run;

  if (r.status === "PREVIEW_READY" && r.previewUrl) return r;
  if (r.status === "DEPLOY_FAILED") return r;

  const repoUrl = setup?.gitRepoUrl?.trim();
  const token = String(setup?.githubAccessToken ?? "").trim();
  const parsed = repoUrl ? composeGithubPagesPreviewUrlFromRepoUrl(repoUrl) : null;

  if (!parsed || !repoUrl) {
    if (r.status === "MERGED" && !r.previewUrl) {
      return (
        updateRun(projectId, runId, {
          status: "DEPLOY_FAILED",
          statusReason: "DEPLOY_FAILED",
          deployFailureDetail: "GitHub 저장소 URL이 없어 Pages 배포를 진행할 수 없습니다.",
        }) ?? r
      );
    }
    return getRun(projectId, runId);
  }

  if (!token) {
    if (r.status === "MERGED" && !r.previewUrl) {
      return (
        updateRun(projectId, runId, {
          status: "DEPLOY_FAILED",
          statusReason: "DEPLOY_FAILED",
          deployFailureDetail: "GitHub 토큰이 없어 배포 설정을 주입·감시할 수 없습니다.",
        }) ?? r
      );
    }
    return getRun(projectId, runId);
  }

  const safeRepo = parsed.repo.replace(/^\/+|\/+$/g, "");
  const basePath = `/${safeRepo}/`;
  const composedUrl = parsed.url;

  if (r.suggestedPreviewUrl !== composedUrl) {
    r = updateRun(projectId, runId, { suggestedPreviewUrl: composedUrl }) ?? r;
  }

  if (r.status === "MERGED") {
    return (
      updateRun(projectId, runId, {
        status: "DEPLOY_CONFIGURING",
        deployFailureDetail: null,
        pagesDeployWorkflowRunUrl: null,
        pagesDeployTriggerCommitSha: null,
        suggestedPreviewUrl: composedUrl,
      }) ?? r
    );
  }

  if (r.status === "DEPLOY_CONFIGURING") {
    const setupOk = await ensureGithubPagesDeploySetupOnMain({
      token,
      owner: parsed.owner,
      repo: parsed.repo,
      basePath,
    });
    if (!setupOk.ok) {
      return (
        updateRun(projectId, runId, {
          status: "DEPLOY_FAILED",
          statusReason: "DEPLOY_FAILED",
          deployFailureDetail: setupOk.error,
        }) ?? r
      );
    }
    return (
      updateRun(projectId, runId, {
        status: "DEPLOYING",
        pagesDeployTriggerCommitSha: setupOk.commitSha,
        deploymentStartedAt: new Date().toISOString(),
        suggestedPreviewUrl: composedUrl,
      }) ?? r
    );
  }

  if (r.status === "DEPLOYING") {
    const headSha = r.pagesDeployTriggerCommitSha?.trim();
    if (!headSha) {
      return (
        updateRun(projectId, runId, {
          status: "DEPLOY_FAILED",
          statusReason: "DEPLOY_FAILED",
          deployFailureDetail: "배포 트리거 커밋 정보가 없습니다.",
        }) ?? r
      );
    }

    const startedMs = r.deploymentStartedAt ? Date.parse(r.deploymentStartedAt) : 0;
    if (startedMs && Date.now() - startedMs > 18 * 60_000) {
      return (
        updateRun(projectId, runId, {
          status: "DEPLOY_FAILED",
          statusReason: "DEPLOY_FAILED",
          deployFailureDetail: "GitHub Actions 배포 대기 시간이 초과되었습니다. 상태 새로고침으로 재시도하세요.",
        }) ?? r
      );
    }

    const wfRun = await findWorkflowRunForHeadSha({
      token,
      owner: parsed.owner,
      repo: parsed.repo,
      headSha,
    });
    if (!wfRun?.id) {
      return getRun(projectId, runId);
    }

    const runUrl = typeof wfRun.html_url === "string" ? wfRun.html_url : null;
    const st = String(wfRun.status ?? "").toLowerCase();
    if (st !== "completed") {
      return (updateRun(projectId, runId, { pagesDeployWorkflowRunUrl: runUrl })) ?? getRun(projectId, runId);
    }

    const conclusion = String(wfRun.conclusion ?? "").toLowerCase();
    if (conclusion !== "success") {
      return (
        updateRun(projectId, runId, {
          status: "DEPLOY_FAILED",
          statusReason: "DEPLOY_FAILED",
          deployFailureDetail: `GitHub Actions 결론: ${wfRun.conclusion ?? "unknown"}`,
          pagesDeployWorkflowRunUrl: runUrl,
        }) ?? r
      );
    }

    const reachable = await verifyGithubPagesUrlReachable(composedUrl);
    if (!reachable) {
      return (
        updateRun(projectId, runId, {
          status: "DEPLOY_FAILED",
          statusReason: "DEPLOY_FAILED",
          deployFailureDetail: "배포 워크플로는 성공했으나 결과 URL에 접근할 수 없습니다.",
          pagesDeployWorkflowRunUrl: runUrl,
          suggestedPreviewUrl: composedUrl,
        }) ?? r
      );
    }

    return (
      updateRun(projectId, runId, {
        status: "PREVIEW_READY",
        previewUrl: composedUrl,
        suggestedPreviewUrl: composedUrl,
        statusReason: null,
        deployFailureDetail: null,
        pagesDeployWorkflowRunUrl: runUrl,
        pagesDeployTriggerCommitSha: headSha,
      }) ?? r
    );
  }

  return getRun(projectId, runId);
}

async function advanceAfterUnitMerged(
  projectId: string,
  runId: string,
  run: PrototypeRun,
  setup: Awaited<ReturnType<typeof prisma.executionSetup.findUnique>>,
  _policy: PrototypePolicy,
): Promise<PrototypeRun | null> {
  if (!allWorkUnitsMerged(run)) {
    const next = activeWorkUnit(run);
    return (
      updateRun(projectId, runId, {
        status: "WORK_UNITS_READY",
        cursorRunId: null,
        commitSha: null,
        changedFiles: [],
        prUrl: null,
        prNumber: null,
        mergeSha: null,
        aiReviewDecision: null,
        aiReviewSummary: null,
        branchName: next?.branchName ?? run.branchName,
        currentWorkUnitOrder: next?.order ?? null,
      }) ?? run
    );
  }

  const r0 = getRun(projectId, runId) ?? run;
  return (await advancePrototypePagesDeployPhase(projectId, runId, r0, setup ?? null)) ?? getRun(projectId, runId);
}

/**
 * WorkUnit 단위 Cursor 폴링 + Git + 검토 + PR/Merge + 다음 유닛 진행.
 */
export async function refreshPrototypeRunState(projectId: string, runId: string): Promise<PrototypeRun | null> {
  const gate = await evaluatePrototypeCursorAutomation(projectId);
  const projectRow = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  const projectName = String(projectRow?.name ?? "Project");

  let run = getRun(projectId, runId);
  if (!run) return null;

  if (run.status === "CANCEL_REQUESTED") {
    run = updateRun(projectId, runId, { status: "CANCELLED" }) ?? run;
    logPrototypePipelineEvent("prototype_cancelled", { projectId, runId });
    return getRun(projectId, runId) ?? run;
  }
  if (run.status === "CANCELLED") return run;

  run = (await maybeRunPlanner(projectId, runId, projectName)) ?? run;

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId } }),
  );

  const policy = setup
    ? derivePrototypePolicyFromExecutionSetup({
        requireApprovalBeforeApply: Boolean(setup.requireApprovalBeforeApply),
        autoPush: Boolean(setup.autoPush),
        autoPr: Boolean(setup.autoPr),
        stopOnOutOfScopeChange: setup.stopOnOutOfScopeChange !== false ? true : false,
      })
    : "manual_review";

  let active = activeWorkUnit(run);
  if (!active) {
    if (
      run.workUnits.length &&
      allWorkUnitsMerged(run) &&
      (run.status === "MERGED" || run.status === "DEPLOY_CONFIGURING" || run.status === "DEPLOYING")
    ) {
      return (await advanceAfterUnitMerged(projectId, runId, run, setup ?? null, policy)) ?? getRun(projectId, runId);
    }
    return getRun(projectId, runId);
  }

  // --- Cursor launch (대기 WorkUnit) ---
  run = getRun(projectId, runId) ?? run;
  active = activeWorkUnit(run) ?? active;
  if (
    gate.automationAvailable &&
    setup &&
    run.status === "WORK_UNITS_READY" &&
    !run.cursorRunId &&
    active.status === "PENDING" &&
    !shouldDeferCursorLaunch(run)
  ) {
    const relay = toRelaySlice(setup);
    const cursor = await requestCursorPrototypeRun({
      projectId,
      executionSetup: relay,
      runId,
      branchName: active.branchName,
      promptSnapshot: run.promptSnapshot,
      selectedTemplate: run.selectedTemplate,
      workUnit: { order: active.order, title: active.title },
    });
    if (cursor.supported) {
      const now = new Date().toISOString();
      const nextUnits = replaceWorkUnit(run.workUnits, active.id, {
        status: "CURSOR_RUNNING",
        cursorRunId: cursor.cursorRunId,
        startedAt: active.startedAt ?? now,
      });
      run =
        updateRun(projectId, runId, {
          status: "CURSOR_REQUESTED",
          cursorRunId: cursor.cursorRunId,
          branchName: active.branchName,
          workUnits: nextUnits,
          currentWorkUnitOrder: active.order,
          statusReason: null,
        }) ?? run;
      logPrototypePipelineEvent("prototype_cursor_requested", {
        projectId,
        runId,
        cursorRunId: cursor.cursorRunId,
        workUnitOrder: active.order,
      });
    } else if (cursor.reason === "CURSOR_LAUNCH_FAILED") {
      updateRun(projectId, runId, { workUnits: replaceWorkUnit(run.workUnits, active.id, { status: "FAILED" }) });
      return markFailed(projectId, runId, "CURSOR_LAUNCH_FAILED", cursor.message);
    } else {
      run = updateRun(projectId, runId, { statusReason: "CURSOR_NOT_CONNECTED" }) ?? run;
    }
    run = getRun(projectId, runId) ?? run;
    active = activeWorkUnit(run) ?? active;
  }

  // --- Cursor poll ---
  const token = setup?.cursorApiToken?.trim();
  if (gate.automationAvailable && run.cursorRunId && setup && token && (run.status === "CURSOR_REQUESTED" || run.status === "CURSOR_RUNNING")) {
    const latest = getRun(projectId, runId);
    if (latest?.status === "CANCEL_REQUESTED") return refreshPrototypeRunState(projectId, runId);

    const polled = await pollCursorAgent({
      cursorApiUrl: setup.cursorApiUrl,
      cursorApiToken: token,
      agentId: run.cursorRunId,
      fallbackBranchName: run.branchName,
    });
    if (!polled.ok) {
      const au = activeWorkUnit(run);
      if (au) {
        updateRun(projectId, runId, { workUnits: replaceWorkUnit(run.workUnits, au.id, { status: "FAILED" }) });
      }
      return markFailed(projectId, runId, "CURSOR_POLL_FAILED", polled.error);
    }
    if (isTerminalAgentFailure(polled.statusUpper)) {
      const au = activeWorkUnit(run);
      if (au) {
        updateRun(projectId, runId, { workUnits: replaceWorkUnit(run.workUnits, au.id, { status: "FAILED" }) });
      }
      return markFailed(projectId, runId, "CURSOR_POLL_FAILED", `Agent status ${polled.statusUpper}`);
    }

    active = activeWorkUnit(run) ?? active;
    if (polled.hints.commitHash) {
      const nextUnits = replaceWorkUnit(run.workUnits, active.id, {
        status: "CURSOR_DONE",
        commitSha: polled.hints.commitHash,
        changedFiles: polled.hints.changedFiles ?? [],
      });
      run =
        updateRun(projectId, runId, {
          status: "COMMIT_DETECTED",
          commitSha: polled.hints.commitHash,
          changedFiles: polled.hints.changedFiles ?? [],
          workUnits: nextUnits,
          branchName: active.branchName,
        }) ?? run;
      logPrototypePipelineEvent("prototype_commit_detected", { projectId, runId, commitSha: polled.hints.commitHash });
    } else if (isTerminalAgentSuccess(polled.statusUpper)) {
      const nextUnits = replaceWorkUnit(run.workUnits, active.id, {
        status: "CURSOR_DONE",
        changedFiles: polled.hints.changedFiles ?? active.changedFiles,
      });
      run =
        updateRun(projectId, runId, {
          status: "CURSOR_RUNNING",
          changedFiles: polled.hints.changedFiles ?? [],
          workUnits: nextUnits,
        }) ?? run;
    } else {
      run = updateRun(projectId, runId, { status: "CURSOR_RUNNING" }) ?? run;
    }
    run = getRun(projectId, runId) ?? run;
    active = activeWorkUnit(run) ?? active;
  }

  // --- Git (활성 유닛 브랜치) ---
  run = getRun(projectId, runId) ?? run;
  active = activeWorkUnit(run) ?? active;
  if (setup?.gitRepoUrl && setup.githubAccessToken !== undefined && active && active.status === "CURSOR_DONE") {
    const latest = getRun(projectId, runId);
    if (latest?.status === "CANCEL_REQUESTED") return refreshPrototypeRunState(projectId, runId);

    const git = await refreshPrototypeGitStateForBranch({
      branchName: active.branchName,
      storedCommitSha: active.commitSha,
      pipelineStatus: run.status,
      projectId,
      repoUrl: setup.gitRepoUrl,
      baseBranch: setup.baseBranch,
      githubAccessToken: setup.githubAccessToken ?? null,
    });

    if (git.patch?.commitSha) {
      const nextUnits = replaceWorkUnit(run.workUnits, active.id, {
        commitSha: git.patch.commitSha,
        changedFiles: run.changedFiles,
      });
      run =
        updateRun(projectId, runId, {
          status: "COMMIT_DETECTED",
          commitSha: git.patch.commitSha,
          workUnits: nextUnits,
          branchName: active.branchName,
        }) ?? run;
    }
    if (git.patch?.status === "PUSH_CONFIRMED") {
      const nextUnits = replaceWorkUnit(run.workUnits, active.id, { status: "GIT_PUSHED" });
      run =
        updateRun(projectId, runId, {
          status: "PUSH_CONFIRMED",
          workUnits: nextUnits,
        }) ?? run;
    }
    run = getRun(projectId, runId) ?? run;
    active = activeWorkUnit(run) ?? active;
  }

  // --- Review ---
  run = getRun(projectId, runId) ?? run;
  active = activeWorkUnit(run) ?? active;
  if (active?.status === "GIT_PUSHED" && run.status === "PUSH_CONFIRMED") {
    const latest = getRun(projectId, runId);
    if (latest?.status === "CANCEL_REQUESTED") return refreshPrototypeRunState(projectId, runId);

    run = updateRun(projectId, runId, { status: "AI_REVIEWING", statusReason: null }) ?? run;
    logPrototypePipelineEvent("prototype_review_started", { projectId, runId, phase: "review", workUnitOrder: active.order });

    const rev = await reviewPrototypeWorkUnit(active);
    if (rev.outcome === "REWORK_REQUIRED") {
      const nextUnits = replaceWorkUnit(run.workUnits, active.id, {
        status: "REVIEW_REWORK",
        reviewSummary: rev.summary,
      });
      run =
        updateRun(projectId, runId, {
          status: "REWORK_REQUIRED",
          aiReviewDecision: "REWORK",
          aiReviewSummary: rev.summary,
          workUnits: nextUnits,
        }) ?? run;
      return run;
    }
    if (rev.outcome === "BLOCKED") {
      const sr = rev.reason === "REVIEW_DATA_MISSING" ? "REVIEW_DATA_MISSING" : "REVIEW_ENGINE_NOT_READY";
      return updateRun(projectId, runId, { status: "BLOCKED", statusReason: sr }) ?? run;
    }
    const nextUnits = replaceWorkUnit(run.workUnits, active.id, {
      status: "REVIEW_PASS",
      reviewSummary: rev.summary ?? null,
    });
    run =
      updateRun(projectId, runId, {
        status: "AI_REVIEWING",
        aiReviewDecision: "PASS",
        aiReviewSummary: rev.summary ?? null,
        workUnits: nextUnits,
      }) ?? run;
    logPrototypePipelineEvent("prototype_review_passed", { projectId, runId, workUnitOrder: active.order });
  }

  // --- PR / Merge (정책) ---
  run = getRun(projectId, runId) ?? run;
  active = activeWorkUnit(run) ?? active;
  if (
    (policy === "auto_pr" || policy === "auto_merge") &&
    active?.status === "REVIEW_PASS" &&
    run.aiReviewDecision === "PASS"
  ) {
    const latest = getRun(projectId, runId);
    if (latest?.status === "CANCEL_REQUESTED") return refreshPrototypeRunState(projectId, runId);
    if (!setup?.gitRepoUrl || !setup.baseBranch) {
      return markFailed(projectId, runId, "EXECUTION_SETUP_INVALID", "repo/baseBranch 없음");
    }
    const pr = await openPrototypePr({
      run,
      projectName,
      repoUrl: setup.gitRepoUrl,
      baseBranch: setup.baseBranch,
      githubAccessToken: setup.githubAccessToken ?? null,
      projectId,
      headBranch: active.branchName,
      prTitleSuffix: `WU${active.order}`,
    });
    if (!pr.ok) {
      const nextUnits = replaceWorkUnit(run.workUnits, active.id, { status: "FAILED" });
      updateRun(projectId, runId, { workUnits: nextUnits });
      return markFailed(projectId, runId, "PR_CREATE_FAILED", pr.message);
    }
    const nextUnits = replaceWorkUnit(run.workUnits, active.id, {
      status: "PR_OPENED",
      prUrl: pr.prUrl,
      prNumber: pr.prNumber,
    });
    run =
      updateRun(projectId, runId, {
        status: "PR_OPENED",
        prUrl: pr.prUrl,
        prNumber: pr.prNumber,
        workUnits: nextUnits,
        statusReason: null,
      }) ?? run;

    // WorkUnit 순환을 위해 PR 이후 머지까지 자동 진행(auto_pr 포함). 수동 승인은 PUSH 단계에서 차단.
    if (policy === "auto_merge" || policy === "auto_pr") {
      const latest2 = getRun(projectId, runId);
      if (latest2?.status === "CANCEL_REQUESTED") return refreshPrototypeRunState(projectId, runId);
      const merged = await mergePrototypePr({ run, githubAccessToken: setup.githubAccessToken ?? null, projectId, prUrl: pr.prUrl });
      if (!merged.ok) {
        const nu = replaceWorkUnit(run.workUnits, active.id, { status: "FAILED" });
        updateRun(projectId, runId, { workUnits: nu });
        return markFailed(projectId, runId, "PR_MERGE_FAILED", merged.message);
      }
      const fin = new Date().toISOString();
      const mergedUnits = replaceWorkUnit(run.workUnits, active.id, {
        status: "MERGED",
        mergeSha: merged.mergeSha,
        finishedAt: fin,
      });
      run =
        updateRun(projectId, runId, {
          status: "MERGED",
          mergeSha: merged.mergeSha,
          workUnits: mergedUnits,
          statusReason: null,
        }) ?? run;
      logPrototypePipelineEvent("prototype_merged", { projectId, runId, workUnitOrder: active.order });
      run = (await advanceAfterUnitMerged(projectId, runId, run, setup ?? null, policy)) ?? run;
    }
  }

  if (run.status === "PUSH_CONFIRMED" && policy === "manual_review") {
    return markBlocked(projectId, runId, "MANUAL_REVIEW_REQUIRED") ?? run;
  }

  // 진행률 표시용 currentWorkUnitOrder 유지
  const prog = workUnitProgressFromRun(run);
  if (prog && run.currentWorkUnitOrder !== prog.current) {
    run = updateRun(projectId, runId, { currentWorkUnitOrder: prog.current }) ?? run;
  }

  run = getRun(projectId, runId) ?? run;
  if (
    setup &&
    allWorkUnitsMerged(run) &&
    (run.status === "MERGED" || run.status === "DEPLOY_CONFIGURING" || run.status === "DEPLOYING")
  ) {
    run = (await advanceAfterUnitMerged(projectId, runId, run, setup, policy)) ?? run;
  }

  return getRun(projectId, runId);
}

export function confirmPrototypeWorkUnitsExecution(projectId: string, runId: string): PrototypeRun | null {
  const cur = getRun(projectId, runId);
  if (!cur) return null;
  if (cur.status !== "WORK_UNITS_READY") return cur;
  return updateRun(projectId, runId, { workUnitsExecutionConfirmed: true }) ?? cur;
}

export async function regeneratePrototypeWorkPlan(input: {
  readonly projectId: string;
  readonly runId: string;
  readonly projectName: string;
  readonly userFeedback?: string;
  readonly plannerContext?: OrchestratePlannerContext;
}): Promise<PrototypeRun | null> {
  const cur = getRun(input.projectId, input.runId);
  if (!cur) return null;
  const prevSummary = summarizeWorkUnitsForPlanner(cur);
  const inferred = inferPlannerInputFromRun(cur, input.projectName);
  const ctx = input.plannerContext;
  const planIn: PlanPrototypeWorkUnitsInput = {
    projectName: input.projectName,
    projectDescription: ctx?.projectDescription ?? inferred.projectDescription,
    ideationSummary: ctx?.ideationSummary ?? inferred.ideationSummary,
    actorFlowSummary: ctx?.actorFlowSummary ?? inferred.actorFlowSummary,
    selectedTemplate: cur.selectedTemplate,
    featureDraftTitles: ctx?.featureDraftTitles ?? inferred.featureDraftTitles,
    promptSnapshot: cur.promptSnapshot,
    repositoryStructureHint: inferred.repositoryStructureHint,
    userFeedback: String(input.userFeedback ?? "").trim(),
    previousWorkUnitsSummary: prevSummary || inferred.previousWorkUnitsSummary,
  };

  updateRun(input.projectId, input.runId, {
    status: "PLANNER_ANALYZING",
    plannerStatus: "RUNNING",
    workUnits: [],
    totalWorkUnits: 0,
    currentWorkUnitOrder: null,
    cursorRunId: null,
    workUnitsExecutionConfirmed: false,
  });

  const plan = await planPrototypeWorkUnitsResolved(planIn, input.runId);
  const plannerSummary =
    plan.plannerSource === "fallback"
      ? `WorkUnit ${plan.workUnits.length}개 재생성 (AI 보조 모드)`
      : `WorkUnit ${plan.workUnits.length}개 재생성`;

  return (
    updateRun(input.projectId, input.runId, {
      status: "WORK_UNITS_READY",
      plannerStatus: "DONE",
      workUnits: plan.workUnits,
      plannerSource: plan.plannerSource,
      totalWorkUnits: plan.workUnits.length,
      currentWorkUnitOrder: plan.workUnits.length ? 1 : null,
      plannerSummary,
      workUnitsExecutionConfirmed: false,
    }) ?? cur
  );
}

/** @deprecated refreshPrototypeRunState 사용 */
export async function refreshPrototypeRunFromCursor(projectId: string, runId: string): Promise<PrototypeRun | null> {
  return refreshPrototypeRunState(projectId, runId);
}
