import type { ImplementationIntegrationEligibility } from "@/lib/prototype/implementationIntegrationEligibility";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { isImplementationPreviewRuntimeReady } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  buildIntegrationEligibilitySummaryLines,
  buildIntegrationScopeCountSummaryLines,
  buildIntegrationScopeDetailLines,
} from "@/lib/prototype/implementationIntegrationScopeUi";
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
}>;

export function buildImplementationIntegrationBoardSection(input: {
  readonly eligibility: ImplementationIntegrationEligibility;
  readonly integratedPipelineLines: readonly ImplementationIntegratedPipelineLine[];
  readonly previewScope?: ImplementationPreviewScopeV1 | null;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
}): ImplementationIntegrationBoardSectionVm {
  const scope = input.previewScope ?? null;
  const previewRuntimeReady = isImplementationPreviewRuntimeReady(input.previewRuntime);
  const previewUrl = String(input.previewRuntime?.previewUrl ?? "").trim() || null;
  const previewStatusLines: string[] = [];
  if (previewRuntimeReady) {
    previewStatusLines.push("통합 완료", "Preview 준비 완료");
    if (input.previewRuntime?.openMode === "external_new_window") {
      previewStatusLines.push("GitHub Pages Preview를 새 창으로 엽니다.");
    } else if (input.previewRuntime?.openMode === "internal_renderer") {
      previewStatusLines.push("플랫폼 내부 Preview Renderer로 확인합니다.");
    }
  } else if (input.previewRuntime?.status === "failed") {
    previewStatusLines.push("통합 완료", "Preview 준비 실패");
    if (input.previewRuntime.errorMessage?.trim()) {
      previewStatusLines.push(`사유: ${input.previewRuntime.errorMessage.trim()}`);
    }
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
  };
}
