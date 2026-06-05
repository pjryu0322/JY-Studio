import type { ImplementationIntegrationEligibility } from "@/lib/prototype/implementationIntegrationEligibility";
import {
  buildIntegrationEligibilitySummaryLines,
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
}>;

export function buildImplementationIntegrationBoardSection(input: {
  readonly eligibility: ImplementationIntegrationEligibility;
  readonly integratedPipelineLines: readonly ImplementationIntegratedPipelineLine[];
  readonly previewScope?: ImplementationPreviewScopeV1 | null;
}): ImplementationIntegrationBoardSectionVm {
  const scope = input.previewScope ?? null;
  return {
    canIntegrate: input.eligibility.canIntegrate,
    showSection: input.eligibility.canIntegrate || input.integratedPipelineLines.length > 0,
    summaryLines: buildIntegrationEligibilitySummaryLines(input.eligibility),
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
  };
}
