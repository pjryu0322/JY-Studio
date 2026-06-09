import { applyIntegratedPipelineSyncSteps } from "@/lib/prototype/implementationIntegratedPipelineBatch";
import type { ImplementationRequirementsBoardOrchestrationSlice } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationPreviewEntryModeV1 } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { parseImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";

export function hasExistingCodeTaskPreviewArtifact(input: {
  readonly previewScopeV1?: unknown;
  readonly previewRuntimeV1?: unknown;
}): boolean {
  const scope = parseImplementationPreviewScopeV1(input.previewScopeV1);
  const runtime = parseImplementationPreviewRuntimeV1(input.previewRuntimeV1);
  if (!scope) return false;
  const hasTasks =
    (scope.includedCodeTasks?.length ?? 0) > 0 || (scope.excludedCodeTasks?.length ?? 0) > 0;
  if (!hasTasks) return false;
  return runtime != null;
}

export function shouldRunCompletedCodeTaskPreviewFallbackOnOpen(input: {
  readonly mode: ImplementationPreviewEntryModeV1;
  readonly integratedAppPreviewReady: boolean;
  readonly previewScopeV1?: unknown;
  readonly previewRuntimeV1?: unknown;
}): boolean {
  if (input.integratedAppPreviewReady) return false;
  if (input.mode !== "codetask_result_preview") return false;
  return !hasExistingCodeTaskPreviewArtifact(input);
}

export function runCompletedCodeTaskPreviewFallbackSync(input: {
  readonly projectId: string;
  readonly orchestration: ImplementationRequirementsBoardOrchestrationSlice;
  readonly externalPreviewUrl?: string | null;
  readonly sourceIntegrationBranch?: string | null;
}) {
  return applyIntegratedPipelineSyncSteps({
    projectId: input.projectId,
    orchestration: input.orchestration,
    externalPreviewUrl: input.externalPreviewUrl ?? null,
    sourceIntegrationBranch: input.sourceIntegrationBranch ?? null,
  });
}
