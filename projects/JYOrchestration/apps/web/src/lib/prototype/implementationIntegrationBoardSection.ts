import type { ImplementationIntegrationEligibility } from "@/lib/prototype/implementationIntegrationEligibility";
import { isIntegrationPreviewRuntimeReady } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { PRE_INTEGRATION_PREVIEW_HINT } from "@/lib/prototype/implementationPreviewOpenTarget";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  buildIntegrationEligibilitySummaryLines,
  buildIntegrationScopeCountSummaryLines,
  buildIntegrationScopeDetailLines,
} from "@/lib/prototype/implementationIntegrationScopeUi";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { canMergeIntegrationPullRequest } from "@/lib/prototype/implementationIntegrationConflict";
import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import type { ImplementationIntegratedPipelineLine } from "@/lib/prototype/implementationTaskPipelinePolicy";

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
  readonly preIntegrationPreviewLine: string | null;
  readonly integrationPlanLines: readonly string[];
  readonly integrationPullRequestUrl: string | null;
  readonly canMergeIntegrationPullRequest: boolean;
}>;

export function buildImplementationIntegrationBoardSection(input: {
  readonly eligibility: ImplementationIntegrationEligibility;
  readonly integratedPipelineLines: readonly ImplementationIntegratedPipelineLine[];
  readonly previewScope?: ImplementationPreviewScopeV1 | null;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly integrationPlan?: CodeTaskIntegrationPlanV1 | null;
}): ImplementationIntegrationBoardSectionVm {
  const scope = input.previewScope ?? null;
  const previewRuntimeReady = isIntegrationPreviewRuntimeReady(input.previewRuntime);
  const previewUrl = String(input.previewRuntime?.previewUrl ?? "").trim() || null;
  const previewStatusLines: string[] = [];
  const canIntegrate = input.eligibility.canIntegrate;
  const preIntegrationPreviewLine =
    !previewRuntimeReady && canIntegrate && input.previewRuntime?.status !== "failed"
      ? PRE_INTEGRATION_PREVIEW_HINT
      : null;
  if (previewRuntimeReady) {
    previewStatusLines.push("통합 완료", "Preview 준비 완료");
    if (input.previewRuntime?.openMode === "external_new_window") {
      previewStatusLines.push("GitHub Pages Preview를 새 창으로 엽니다.");
    } else if (input.previewRuntime?.openMode === "internal_renderer") {
      previewStatusLines.push("플랫폼 내부 Preview Renderer로 확인합니다.");
    }
  } else if (input.previewRuntime?.status === "failed") {
    previewStatusLines.push(
      scope ? "통합 완료" : "통합 실패",
      "Preview 준비 실패",
    );
    if (input.previewRuntime.errorMessage?.trim()) {
      previewStatusLines.push(`사유: ${input.previewRuntime.errorMessage.trim()}`);
    }
  }

  const integrationPlanLines: string[] = [];
  const plan = input.integrationPlan ?? null;
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
    scopeDetailLines: buildIntegrationScopeDetailLines(scope),
    previewRuntimeReady,
    previewUrl,
    previewStatusLines,
    preIntegrationPreviewLine,
    integrationPlanLines,
    integrationPullRequestUrl: String(plan?.pullRequestUrl ?? "").trim() || null,
    canMergeIntegrationPullRequest: canMergeIntegrationPullRequest(plan),
  };
}
