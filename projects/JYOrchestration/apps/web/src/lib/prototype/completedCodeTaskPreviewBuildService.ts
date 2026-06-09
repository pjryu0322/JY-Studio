import { applyIntegratedPipelineSyncSteps } from "@/lib/prototype/implementationIntegratedPipelineBatch";
import type { ImplementationRequirementsBoardOrchestrationSlice } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationPreviewActionSourceV1 } from "@/lib/prototype/implementationPreviewActionSource";
import { buildCodeTaskPreviewFallbackUrl } from "@/lib/prototype/implementationPreviewEntryPolicy";

export type EnsureCompletedCodeTaskPreviewForFallbackResultV1 = Readonly<{
  readonly ok: boolean;
  readonly previewUrl: string | null;
  readonly message: string | null;
  readonly orchestrationPatch?: Record<string, unknown>;
}>;

const ALLOWED_FALLBACK_SOURCES: ReadonlySet<ImplementationPreviewActionSourceV1> = new Set([
  "preview_button",
  "diagnostic",
]);

export async function ensureCompletedCodeTaskPreviewForFallback(input: {
  readonly projectId: string;
  readonly actionSource: ImplementationPreviewActionSourceV1;
  readonly orchestration: ImplementationRequirementsBoardOrchestrationSlice;
  readonly externalPreviewUrl?: string | null;
  readonly sourceIntegrationBranch?: string | null;
}): Promise<EnsureCompletedCodeTaskPreviewForFallbackResultV1> {
  const pid = input.projectId.trim();
  if (!pid) {
    return { ok: false, previewUrl: null, message: "프로젝트를 선택해 주세요." };
  }
  if (!ALLOWED_FALLBACK_SOURCES.has(input.actionSource)) {
    return {
      ok: false,
      previewUrl: null,
      message: "completed CodeTask preview build는 Preview fallback에서만 실행할 수 있습니다.",
    };
  }

  const batch = applyIntegratedPipelineSyncSteps({
    projectId: pid,
    orchestration: input.orchestration,
    externalPreviewUrl: input.externalPreviewUrl ?? null,
    sourceIntegrationBranch: input.sourceIntegrationBranch ?? null,
  });

  if (!batch.ok) {
    return { ok: false, previewUrl: null, message: batch.message };
  }

  const previewUrl = batch.previewUrl?.trim() || buildCodeTaskPreviewFallbackUrl(pid);
  const orchestrationPatch: Record<string, unknown> = {
    implementationIntegratedExecutionStateV1: batch.integratedState,
    ...(batch.previewScope ? { implementationPreviewScopeV1: batch.previewScope } : {}),
    ...(batch.previewRuntime ? { implementationPreviewRuntimeV1: batch.previewRuntime } : {}),
  };

  return {
    ok: true,
    previewUrl,
    message: null,
    orchestrationPatch,
  };
}
