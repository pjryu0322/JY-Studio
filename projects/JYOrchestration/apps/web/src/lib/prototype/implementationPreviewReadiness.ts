import {
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import {
  INTEGRATION_WIRING_CODE_TASK_ID,
  isIntegrationWiringCodeTask,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";
import {
  buildImplementationCodeTaskSummaryCounts,
  isCodeTaskCompletedForSummary,
} from "@/lib/prototype/implementationCodeTaskSummary";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { countVerifiedSelectedExecutionUnits } from "@/lib/prototype/implementationExecutionSelectedUnits";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { ImplementationIntegrationEligibility } from "@/lib/prototype/implementationIntegrationEligibility";
import {
  isIntegratedAppRenderTarget,
  resolveImplementationAppPreviewTarget,
  resolveIntegrationPlanBuildStatus,
} from "@/lib/prototype/implementationAppPreviewTarget";
import { evaluateImplementationIntegrationEligibility } from "@/lib/prototype/implementationIntegrationEligibility";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { isPreviewRuntimeOpenReady } from "@/lib/prototype/implementationIntegrationButtonPolicy";

type OrchestrationPreviewSlice = Readonly<{
  readonly implementationCodeTaskPlanV1?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly codeTaskIntegrationPlanV1?: unknown;
  readonly implementationPreviewRuntimeV1?: unknown;
  readonly implementationTaskListV1?: import("@/lib/requirements/implementationTaskList").ImplementationTaskListV1 | null;
  readonly implementationAutoQualityGateV1?: import("@/lib/prototype/implementationAutoQualityGate").ImplementationAutoQualityGateV1 | null;
}>;

export type ImplementationPreviewModeV1 =
  | "not_ready"
  | "code_task_preview_ready"
  | "integration_pending"
  | "integration_blocked"
  | "final_wiring_pending"
  | "build_pending"
  | "build_failed"
  | "integrated_app_preview_ready";

export type ImplementationPreviewReadinessV1 = Readonly<{
  readonly mode: ImplementationPreviewModeV1;
  readonly codeTaskPreviewReady: boolean;
  readonly integratedAppPreviewReady: boolean;
  readonly statusTitleLines: readonly string[];
  readonly integratedAppGateLines: readonly string[];
  readonly codeTaskScopeTitleLine: string | null;
  readonly conclusionLine: string | null;
  readonly finalWiringPending: boolean;
  readonly integrationPrecheckBlocked: boolean;
}>;

function isFinalWiringCompleted(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly eligibility: ImplementationIntegrationEligibility;
}): boolean {
  const wiringTask = input.codeTaskPlan?.tasks.find((t) => isIntegrationWiringCodeTask(t));
  if (wiringTask) {
    const run = findLatestRunForCodeTask(input.runs, wiringTask.codeTaskId);
    return isCodeTaskCompletedForSummary(run);
  }
  const wiringExcluded = input.eligibility.excluded.some(
    (row) => row.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID,
  );
  if (wiringExcluded) return false;
  return true;
}

function isIntegrationPlanPrecheckBlocked(
  plan: CodeTaskIntegrationPlanV1 | null | undefined,
): boolean {
  if (!plan || plan.status !== "failed") return false;
  const msg = String(plan.failureMessage ?? "").trim();
  if (!msg) return true;
  return (
    /overlap|precheck|changed files|사전점검|충돌/i.test(msg) ||
    /merge/i.test(msg)
  );
}

export function evaluateImplementationPreviewReadiness(input: {
  readonly projectId?: string | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly eligibility: ImplementationIntegrationEligibility;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly integrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly requirementsState?: import("@/lib/requirements/requirementsStateJson").RequirementsStateJson | null;
}): ImplementationPreviewReadinessV1 {
  const summary = input.requirementsState
    ? buildImplementationExecutionSummaryCounts({
        projectId: input.projectId,
        requirementsState: input.requirementsState,
        codeTaskPlan: input.codeTaskPlan,
        runs: input.codeTaskRuns,
      })
    : buildImplementationCodeTaskSummaryCounts({
        codeTaskPlan: input.codeTaskPlan,
        runs: input.codeTaskRuns,
      });
  const visibleTotal = summary.totalCodeTaskCount;
  const verifiedUnitCount = input.requirementsState
    ? countVerifiedSelectedExecutionUnits({
        units: "executionUnits" in summary ? summary.executionUnits : [],
        selectedUnitIds:
          "selectedExecutionUnitIds" in summary ? summary.selectedExecutionUnitIds : [],
      })
    : 0;
  const allVisibleCompleted =
    visibleTotal > 0 && summary.completedCodeTaskCount >= visibleTotal;
  const codeTaskPreviewReady =
    verifiedUnitCount > 0 ||
    summary.completedCodeTaskCount > 0 ||
    Boolean(
      input.previewRuntime?.status === "ready" &&
        String(input.previewRuntime.previewUrl ?? "").trim(),
    );

  const finalWiringCompleted = isFinalWiringCompleted({
    codeTaskPlan: input.codeTaskPlan,
    runs: input.codeTaskRuns,
    eligibility: input.eligibility,
  });
  const wiringExcluded = input.eligibility.excluded.find(
    (row) => row.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID,
  );
  const finalWiringPending = !finalWiringCompleted;

  const plan = input.integrationPlan ?? null;
  const integrationBranch =
    String(input.previewRuntime?.sourceIntegrationBranch ?? plan?.integrationBranch ?? "").trim() ||
    null;
  const precheckBlocked = isIntegrationPlanPrecheckBlocked(plan);
  const buildStatus = resolveIntegrationPlanBuildStatus(plan);
  const integratedRenderOk = isIntegratedAppRenderTarget({
    runtime: input.previewRuntime,
    integrationPlan: plan,
    projectId: input.projectId,
  });

  let mode: ImplementationPreviewModeV1 = "not_ready";
  if (!codeTaskPreviewReady) {
    mode = "not_ready";
  } else if (precheckBlocked || plan?.status === "conflict") {
    mode = "integration_blocked";
  } else if (finalWiringPending) {
    mode = "final_wiring_pending";
  } else if (!integrationBranch) {
    mode = "integration_pending";
  } else if (buildStatus === "failed") {
    mode = "build_failed";
  } else if (!integratedRenderOk || buildStatus === "pending") {
    mode = "build_pending";
  } else if (allVisibleCompleted && integratedRenderOk) {
    mode = "integrated_app_preview_ready";
  } else if (codeTaskPreviewReady) {
    mode = "code_task_preview_ready";
  }

  const integratedAppPreviewReady = mode === "integrated_app_preview_ready";

  const statusTitleLines: string[] = [];
  switch (mode) {
    case "final_wiring_pending":
      statusTitleLines.push("통합 대기");
      statusTitleLines.push(
        "최종 연결/통합 Wiring이 아직 완료되지 않아 실제 앱 Preview를 준비할 수 없습니다.",
      );
      statusTitleLines.push("CodeTask 결과 미리보기만 가능합니다.");
      break;
    case "integration_blocked":
      statusTitleLines.push("통합 차단");
      statusTitleLines.push(
        "통합 사전점검이 차단되어 실제 앱 Preview를 만들 수 없습니다.",
      );
      statusTitleLines.push("차단 사유를 해결한 뒤 다시 통합을 실행하세요.");
      break;
    case "integration_pending":
      statusTitleLines.push("통합 대기");
      statusTitleLines.push("통합 branch가 아직 준비되지 않았습니다.");
      statusTitleLines.push("CodeTask 결과 미리보기만 가능합니다.");
      break;
    case "build_pending":
      statusTitleLines.push("통합 진행 중");
      statusTitleLines.push("build 검증 또는 app entry 렌더링이 아직 완료되지 않았습니다.");
      break;
    case "build_failed":
      statusTitleLines.push("통합 실패");
      statusTitleLines.push("build 검증에 실패하여 실제 앱 Preview를 열 수 없습니다.");
      break;
    case "code_task_preview_ready":
      statusTitleLines.push("CodeTask Preview 준비 완료");
      statusTitleLines.push("완료된 CodeTask 산출물을 진단용으로 확인할 수 있습니다.");
      statusTitleLines.push("아직 실제 앱 Preview는 준비되지 않았습니다.");
      break;
    case "integrated_app_preview_ready":
      statusTitleLines.push("통합 완료");
      statusTitleLines.push("실제 앱 Preview 준비 완료");
      statusTitleLines.push("최종 Wiring, 통합 branch, build 검증이 완료되었습니다.");
      break;
    default:
      break;
  }

  const integratedAppGateLines: string[] = ["실제 앱 Preview 준비 상태"];
  if (finalWiringPending) {
    integratedAppGateLines.push(
      `- 최종 연결/통합 Wiring: ${wiringExcluded?.status.trim() || "대기"}`,
    );
  } else {
    integratedAppGateLines.push("- 최종 연결/통합 Wiring: 완료");
  }
  if (precheckBlocked) {
    integratedAppGateLines.push("- 통합 사전점검: 차단");
  } else if (plan?.status === "failed") {
    integratedAppGateLines.push("- 통합 사전점검: 실패");
  } else if (integrationBranch) {
    integratedAppGateLines.push("- 통합 사전점검: 통과 또는 미실행");
  } else {
    integratedAppGateLines.push("- 통합 사전점검: 미완료");
  }
  integratedAppGateLines.push(
    integrationBranch ? `- 통합 branch: ${integrationBranch}` : "- 통합 branch: 없음",
  );
  integratedAppGateLines.push(
    buildStatus === "passed"
      ? "- build 검증: 완료"
      : buildStatus === "failed"
        ? "- build 검증: 실패"
        : "- build 검증: 미완료",
  );
  const appTarget = resolveImplementationAppPreviewTarget({
    projectId: input.projectId,
    runtime: input.previewRuntime,
    integrationPlan: plan,
    finalWiringCodeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
  });
  integratedAppGateLines.push(
    appTarget.appEntryPath || appTarget.externalPreviewUrl
      ? "- app entry 렌더링: 확인됨"
      : "- app entry 렌더링: 미확인",
  );

  const codeTaskScopeTitleLine = codeTaskPreviewReady
    ? `CodeTask 결과 미리보기 범위 · 완료 ${summary.completedCodeTaskCount}개`
    : null;

  const conclusionLine =
    integratedAppPreviewReady
      ? null
      : "현재는 실제 앱 Preview가 아니라 CodeTask 결과 미리보기만 가능합니다.";

  return {
    mode,
    codeTaskPreviewReady,
    integratedAppPreviewReady,
    statusTitleLines,
    integratedAppGateLines,
    codeTaskScopeTitleLine,
    conclusionLine,
    finalWiringPending,
    integrationPrecheckBlocked: precheckBlocked,
  };
}

export function isCodeTaskDiagnosticPreviewOpenReady(input: {
  readonly readiness: ImplementationPreviewReadinessV1;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
}): boolean {
  if (!input.readiness.codeTaskPreviewReady) return false;
  return isPreviewRuntimeOpenReady(input.previewRuntime) || Boolean(input.previewRuntime?.previewUrl);
}

export function resolveIntegratedAppPreviewReadyFromOrchestration(input: {
  readonly projectId: string;
  readonly orchestration: OrchestrationPreviewSlice | null | undefined;
}): boolean {
  const orch = input.orchestration;
  const codeTaskPlan = parseImplementationCodeTaskPlanV1(orch?.implementationCodeTaskPlanV1) ?? null;
  const runs = parseCodeTaskExecutionRunsV1(orch?.codeTaskExecutionRunsV1) ?? [];
  const integrationPlan = parseCodeTaskIntegrationPlanV1(orch?.codeTaskIntegrationPlanV1) ?? null;
  const previewRuntime = parseImplementationPreviewRuntimeV1(orch?.implementationPreviewRuntimeV1) ?? null;
  const eligibility = evaluateImplementationIntegrationEligibility({
    codeTaskPlan,
    taskList: orch?.implementationTaskListV1 ?? null,
    codeTaskRuns: runs,
    autoQualityGate: orch?.implementationAutoQualityGateV1 ?? null,
  });
  return evaluateImplementationPreviewReadiness({
    projectId: input.projectId,
    codeTaskPlan,
    codeTaskRuns: runs,
    eligibility,
    previewRuntime,
    integrationPlan,
  }).integratedAppPreviewReady;
}
