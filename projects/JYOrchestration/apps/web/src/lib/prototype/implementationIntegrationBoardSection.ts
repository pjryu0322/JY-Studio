import type { ImplementationIntegrationEligibility } from "@/lib/prototype/implementationIntegrationEligibility";
import { PRE_INTEGRATION_PREVIEW_HINT } from "@/lib/prototype/implementationPreviewOpenTarget";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  evaluateImplementationPreviewReadiness,
  type ImplementationPreviewReadinessV1,
} from "@/lib/prototype/implementationPreviewReadiness";
import {
  buildIntegrationEligibilitySummaryLines,
  buildIntegrationEligibilitySummaryLinesFromSnapshot,
  buildIntegrationScopeCountSummaryLines,
  buildIntegrationScopeDetailLines,
} from "@/lib/prototype/implementationIntegrationScopeUi";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { normalizeCodeTaskIntegrationPlan } from "@/lib/prototype/implementationIntegrationPlanNormalize";
import { canMergeIntegrationPullRequest } from "@/lib/prototype/implementationIntegrationConflict";
import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import type { ImplementationIntegratedPipelineLine } from "@/lib/prototype/implementationTaskPipelinePolicy";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildIntegrationStepStatusLines } from "@/lib/prototype/implementationIntegrationStatus";
import { resolveIntegrationStepsForRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { integrationPlanHasSuccessfulMerge } from "@/lib/prototype/implementationIntegrationPlanMergeStatus";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

export type ImplementationIntegrationBoardSectionVm = Readonly<{
  readonly canIntegrate: boolean;
  readonly showSection: boolean;
  readonly summaryLines: readonly string[];
  readonly pipelineLines: readonly ImplementationIntegratedPipelineLine[];
  readonly scopeDetailLines: readonly string[];
  readonly previewRuntimeReady: boolean;
  readonly previewUrl: string | null;
  readonly previewStatusLines: readonly string[];
  readonly previewReadiness: ImplementationPreviewReadinessV1;
  readonly codeTaskPreviewReady: boolean;
  readonly integratedAppPreviewReady: boolean;
  readonly preIntegrationPreviewLine: string | null;
  readonly integrationPlanLines: readonly string[];
  readonly integrationPullRequestUrl: string | null;
  readonly canMergeIntegrationPullRequest: boolean;
}>;

function dedupeScopeDetailLines(lines: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function buildImplementationIntegrationBoardSection(input: {
  readonly projectId?: string | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly eligibility: ImplementationIntegrationEligibility;
  readonly integratedPipelineLines: readonly ImplementationIntegratedPipelineLine[];
  readonly previewScope?: ImplementationPreviewScopeV1 | null;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly integrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly runtimeSnapshot?: ImplementationRuntimeSnapshotV1 | null;
}): ImplementationIntegrationBoardSectionVm {
  const scope = input.previewScope ?? null;
  const snapshot = input.runtimeSnapshot ?? null;
  const previewReadiness = evaluateImplementationPreviewReadiness({
    projectId: input.projectId,
    codeTaskPlan: input.codeTaskPlan ?? null,
    codeTaskRuns: input.codeTaskRuns,
    eligibility: input.eligibility,
    previewRuntime: input.previewRuntime,
    integrationPlan: input.integrationPlan,
    requirementsState: input.requirementsState,
  });
  const integrationSteps = resolveIntegrationStepsForRuntimeSnapshot({
    requirementsState: input.requirementsState,
    codeTaskPlan: input.codeTaskPlan,
  });
  const integrationStepLines = buildIntegrationStepStatusLines(integrationSteps);
  const integratedAppPreviewReady = snapshot
    ? snapshot.preview.integratedAppPreviewReady || previewReadiness.integratedAppPreviewReady
    : previewReadiness.integratedAppPreviewReady;
  const codeTaskPreviewReady = snapshot
    ? snapshot.preview.codeTaskPreviewReady
    : previewReadiness.codeTaskPreviewReady;
  const previewRuntimeReady = integratedAppPreviewReady;
  const previewUrl =
    String(input.previewRuntime?.previewUrl ?? "").trim() ||
    snapshot?.preview.previewUrl ||
    null;
  const previewStatusLines: string[] = integratedAppPreviewReady
    ? [
        "통합 및 Preview 준비 완료",
        ...integrationStepLines,
        "Preview 버튼을 눌러 실제 앱 화면을 확인할 수 있습니다.",
      ]
    : snapshot
      ? snapshot.preview.message.split("\n").filter(Boolean)
      : [...previewReadiness.statusTitleLines];
  const canIntegrate = snapshot
    ? snapshot.integration.canRunIntegration || snapshot.codeTask.completed > 0
    : input.eligibility.canIntegrate;
  const preIntegrationPreviewLine =
    !integratedAppPreviewReady &&
    canIntegrate &&
    input.previewRuntime?.status !== "failed"
      ? PRE_INTEGRATION_PREVIEW_HINT
      : null;
  if (integratedAppPreviewReady && input.previewRuntime?.openMode === "external_new_window") {
    previewStatusLines.push("GitHub Pages Preview를 새 창으로 엽니다.");
  } else if (
    integratedAppPreviewReady &&
    input.previewRuntime?.openMode === "internal_renderer"
  ) {
    previewStatusLines.push("실제 app entry Preview를 새 창으로 엽니다.");
  }
  if (input.previewRuntime?.status === "failed" && !integratedAppPreviewReady) {
    previewStatusLines.push("Preview 준비 실패");
    if (input.previewRuntime.errorMessage?.trim()) {
      previewStatusLines.push(`사유: ${input.previewRuntime.errorMessage.trim()}`);
    }
  }

  const integrationPlanLines: string[] = [];
  const plan = input.integrationPlan ? normalizeCodeTaskIntegrationPlan(input.integrationPlan) : null;
  if (plan?.status === "conflict") {
    integrationPlanLines.push(
      `통합 충돌 발생${plan.conflictCodeTaskId ? ` (CodeTask ${plan.conflictCodeTaskId})` : ""}`,
    );
    if (plan.failureMessage) integrationPlanLines.push(`사유: ${plan.failureMessage}`);
  } else if (plan?.integrationBranch && integrationPlanHasSuccessfulMerge(plan)) {
    integrationPlanLines.push("통합 branch가 준비되었습니다.");
    integrationPlanLines.push(
      `Preview는 통합 branch 기준입니다. 포함 ${plan.included.length}개 · 제외 ${plan.excluded.length}개`,
    );
  } else if (plan?.integrationBranch) {
    integrationPlanLines.push("통합 branch를 준비 중입니다.");
  }
  if (plan?.status === "pr_ready" && plan.pullRequestUrl) {
    integrationPlanLines.push("통합 PR 준비 완료 · Preview 확인 후 main 반영을 승인할 수 있습니다.");
  }

  return {
    canIntegrate,
    showSection:
      canIntegrate ||
      input.integratedPipelineLines.length > 0 ||
      (snapshot?.codeTask.selected ?? 0) > 0,
    summaryLines: [
      ...(snapshot
        ? buildIntegrationEligibilitySummaryLinesFromSnapshot(snapshot)
        : buildIntegrationEligibilitySummaryLines(input.eligibility)),
      ...buildIntegrationScopeCountSummaryLines(scope),
      ...integrationStepLines,
    ],
    pipelineLines: input.integratedPipelineLines,
    scopeDetailLines: integratedAppPreviewReady
      ? [
          "실제 앱 Preview가 준비되었습니다.",
          "Preview 버튼을 눌러 실제 앱 화면을 확인할 수 있습니다.",
        ]
      : dedupeScopeDetailLines([
          ...(previewReadiness.codeTaskScopeTitleLine ? [previewReadiness.codeTaskScopeTitleLine] : []),
          ...buildIntegrationScopeDetailLines(scope),
          ...previewReadiness.integratedAppGateLines,
          ...(previewReadiness.conclusionLine ? [previewReadiness.conclusionLine] : []),
        ]),
    previewRuntimeReady,
    previewUrl,
    previewStatusLines,
    previewReadiness,
    codeTaskPreviewReady,
    integratedAppPreviewReady,
    preIntegrationPreviewLine,
    integrationPlanLines,
    integrationPullRequestUrl: String(plan?.pullRequestUrl ?? "").trim() || null,
    canMergeIntegrationPullRequest: canMergeIntegrationPullRequest(plan),
  };
}
