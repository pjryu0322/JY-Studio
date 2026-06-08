import type { ImplementationIntegrationEligibility } from "@/lib/prototype/implementationIntegrationEligibility";
import { PRE_INTEGRATION_PREVIEW_HINT } from "@/lib/prototype/implementationPreviewOpenTarget";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  evaluateImplementationPreviewReadiness,
  type ImplementationPreviewReadinessV1,
} from "@/lib/prototype/implementationPreviewReadiness";
import {
  buildIntegrationEligibilitySummaryLines,
  buildIntegrationScopeCountSummaryLines,
  buildIntegrationScopeDetailLines,
} from "@/lib/prototype/implementationIntegrationScopeUi";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { normalizeCodeTaskIntegrationPlan } from "@/lib/prototype/implementationIntegrationPlanNormalize";
import { canMergeIntegrationPullRequest } from "@/lib/prototype/implementationIntegrationConflict";
import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import type { ImplementationIntegratedPipelineLine } from "@/lib/prototype/implementationTaskPipelinePolicy";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildIntegrationStepStatusLines } from "@/lib/prototype/implementationIntegrationStatus";
import { loadImplementationIntegrationStepsFromState } from "@/lib/prototype/implementationIntegrationStepStore";
import { ensurePersistedImplementationIntegrationSteps } from "@/lib/prototype/implementationIntegrationStepBootstrap";

export type ImplementationIntegrationBoardSectionVm = Readonly<{
  readonly canIntegrate: boolean;
  readonly showSection: boolean;
  readonly summaryLines: readonly string[];
  readonly pipelineLines: readonly ImplementationIntegratedPipelineLine[];
  readonly includedPreviewRows: readonly { readonly codeTaskId: string; readonly title: string }[];
  readonly excludedPreviewRows: readonly { readonly codeTaskId: string; readonly label: string }[];
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
}): ImplementationIntegrationBoardSectionVm {
  const scope = input.previewScope ?? null;
  const previewReadiness = evaluateImplementationPreviewReadiness({
    projectId: input.projectId,
    codeTaskPlan: input.codeTaskPlan ?? null,
    codeTaskRuns: input.codeTaskRuns,
    eligibility: input.eligibility,
    previewRuntime: input.previewRuntime,
    integrationPlan: input.integrationPlan,
    requirementsState: input.requirementsState,
  });
  const integrationSteps = (() => {
    const persisted = loadImplementationIntegrationStepsFromState(input.requirementsState);
    if (persisted.length) return persisted;
    const ensured = ensurePersistedImplementationIntegrationSteps({
      projectId: String(input.projectId ?? "").trim(),
      requirementsState: input.requirementsState,
      codeTaskPlan: input.codeTaskPlan,
    });
    return ensured.steps;
  })();
  const integrationStepLines = buildIntegrationStepStatusLines(integrationSteps);
  const previewRuntimeReady = previewReadiness.integratedAppPreviewReady;
  const previewUrl = String(input.previewRuntime?.previewUrl ?? "").trim() || null;
  const previewStatusLines: string[] = [...previewReadiness.statusTitleLines];
  const canIntegrate = input.eligibility.canIntegrate;
  const preIntegrationPreviewLine =
    !previewReadiness.integratedAppPreviewReady &&
    canIntegrate &&
    input.previewRuntime?.status !== "failed"
      ? PRE_INTEGRATION_PREVIEW_HINT
      : null;
  if (previewReadiness.integratedAppPreviewReady && input.previewRuntime?.openMode === "external_new_window") {
    previewStatusLines.push("GitHub Pages Preview를 새 창으로 엽니다.");
  } else if (
    previewReadiness.integratedAppPreviewReady &&
    input.previewRuntime?.openMode === "internal_renderer"
  ) {
    previewStatusLines.push("실제 app entry Preview를 새 창으로 엽니다.");
  }
  if (input.previewRuntime?.status === "failed" && !previewReadiness.integratedAppPreviewReady) {
    previewStatusLines.push("Preview 준비 실패");
    if (input.previewRuntime.errorMessage?.trim()) {
      previewStatusLines.push(`사유: ${input.previewRuntime.errorMessage.trim()}`);
    }
  }

  const integrationPlanLines: string[] = [];
  const plan = input.integrationPlan ? normalizeCodeTaskIntegrationPlan(input.integrationPlan) : null;
  if (plan?.integrationBranch) {
    integrationPlanLines.push(`Integration branch: ${plan.integrationBranch}`);
    integrationPlanLines.push(`Preview는 통합 branch 기준입니다. 포함 ${plan.included.length}개 · 제외 ${plan.excluded.length}개`);
  }
  if (plan?.status === "conflict") {
    integrationPlanLines.push(
      `통합 충돌 발생${plan.conflictCodeTaskId ? ` (CodeTask ${plan.conflictCodeTaskId})` : ""}`,
    );
    if (plan.failureMessage) integrationPlanLines.push(`사유: ${plan.failureMessage}`);
  }
  if (plan?.status === "pr_ready" && plan.pullRequestUrl) {
    integrationPlanLines.push("통합 PR 준비 완료 · Preview 확인 후 main 반영을 승인할 수 있습니다.");
  }

  return {
    canIntegrate: input.eligibility.canIntegrate,
    showSection: input.eligibility.canIntegrate || input.integratedPipelineLines.length > 0,
    summaryLines: [
      ...buildIntegrationEligibilitySummaryLines(input.eligibility),
      ...buildIntegrationScopeCountSummaryLines(scope),
      ...integrationStepLines,
    ],
    pipelineLines: input.integratedPipelineLines,
    includedPreviewRows:
      scope?.includedCodeTasks.map((row) => ({
        codeTaskId: row.codeTaskId,
        title: row.title,
      })) ?? [],
    excludedPreviewRows:
      scope?.excludedCodeTasks.slice(0, 8).map((row) => ({
        codeTaskId: row.codeTaskId,
        label: `${row.title}: ${row.status.trim() || row.reason}`,
      })) ?? [],
    scopeDetailLines: dedupeScopeDetailLines([
      ...(previewReadiness.codeTaskScopeTitleLine ? [previewReadiness.codeTaskScopeTitleLine] : []),
      ...buildIntegrationScopeDetailLines(scope),
      ...previewReadiness.integratedAppGateLines,
      ...(previewReadiness.conclusionLine ? [previewReadiness.conclusionLine] : []),
    ]),
    previewRuntimeReady,
    previewUrl,
    previewStatusLines,
    previewReadiness,
    codeTaskPreviewReady: previewReadiness.codeTaskPreviewReady,
    integratedAppPreviewReady: previewReadiness.integratedAppPreviewReady,
    preIntegrationPreviewLine,
    integrationPlanLines,
    integrationPullRequestUrl: String(plan?.pullRequestUrl ?? "").trim() || null,
    canMergeIntegrationPullRequest: canMergeIntegrationPullRequest(plan),
  };
}
