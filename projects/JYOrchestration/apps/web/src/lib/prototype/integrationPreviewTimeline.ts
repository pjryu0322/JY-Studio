import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type CompletedCodeTaskIntegrationTimelineAction =
  | "completed_codetask_integration_started"
  | "completed_codetask_integration_completed"
  | "completed_codetask_preview_build_started"
  | "completed_codetask_preview_ready"
  | "completed_codetask_external_preview_ready"
  | "completed_codetask_internal_preview_ready"
  | "completed_codetask_preview_failed"
  | "completed_codetask_preview_fallback";

export function buildCompletedCodeTaskIntegrationTimelineEntry(input: {
  readonly action: CompletedCodeTaskIntegrationTimelineAction;
  readonly projectId: string;
  readonly includedCount?: number;
  readonly excludedCount?: number;
  readonly previewUrl?: string | null;
  readonly appPreviewUrl?: string | null;
  readonly externalPreviewUrl?: string | null;
  readonly internalAppPreviewUrl?: string | null;
  readonly renderMode?: string | null;
  readonly openMode?: string | null;
  readonly reason?: string | null;
  readonly errorMessage?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: input.action,
    nowIso: input.nowIso,
    fields: {
      projectId: input.projectId,
      ...(input.includedCount !== undefined ? { includedCount: input.includedCount } : {}),
      ...(input.excludedCount !== undefined ? { excludedCount: input.excludedCount } : {}),
      ...(input.previewUrl ? { previewUrl: input.previewUrl } : {}),
      ...(input.appPreviewUrl ? { appPreviewUrl: input.appPreviewUrl } : {}),
      ...(input.externalPreviewUrl ? { externalPreviewUrl: input.externalPreviewUrl } : {}),
      ...(input.internalAppPreviewUrl ? { internalAppPreviewUrl: input.internalAppPreviewUrl } : {}),
      ...(input.renderMode ? { renderMode: input.renderMode } : {}),
      ...(input.openMode ? { openMode: input.openMode } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
    error: input.errorMessage ?? undefined,
  });
}
