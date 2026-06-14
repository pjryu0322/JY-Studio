import {
  buildCodeTaskPreviewFallbackUrl,
  buildIntegratedAppPreviewFallbackUrl,
  sanitizeIntegratedAppPreviewUrl,
  type ImplementationPreviewEntryModeV1,
} from "@/lib/prototype/implementationPreviewEntryPolicy";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { resolveIntegratedAppPreviewReadyFromOrchestration } from "@/lib/prototype/implementationPreviewReadiness";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ImplementationToolbarPreviewEntryV1 = Readonly<{
  readonly showToolbarIcon: boolean;
  readonly enabled: boolean;
  readonly url: string | null;
  readonly mode: ImplementationPreviewEntryModeV1;
}>;

function firstSanitizedUrl(projectId: string, candidates: readonly (string | null | undefined)[]): string | null {
  const pid = projectId.trim();
  for (const c of candidates) {
    const sanitized = sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: c });
    if (sanitized) return sanitized;
  }
  return null;
}

export function resolveImplementationToolbarPreviewEntry(input: {
  readonly projectId: string;
  readonly orchestration: RequirementsStateJson;
  readonly controlPlanePreviewReady?: boolean;
  readonly controlPlanePreviewUrl?: string | null;
  readonly hostPreviewUrl?: string | null;
  readonly prototypeRunPreviewReady?: boolean;
}): ImplementationToolbarPreviewEntryV1 {
  const pid = input.projectId.trim();
  if (!pid) {
    return { showToolbarIcon: false, enabled: false, url: null, mode: "disabled" };
  }

  const integratedReady = resolveIntegratedAppPreviewReadyFromOrchestration({
    projectId: pid,
    orchestration: input.orchestration,
  });
  const runtime = parseImplementationPreviewRuntimeV1(input.orchestration.implementationPreviewRuntimeV1);

  let url = firstSanitizedUrl(pid, [
    input.controlPlanePreviewUrl,
    input.hostPreviewUrl,
    runtime?.internalAppPreviewUrl,
    runtime?.previewUrl,
    runtime?.externalPreviewUrl,
    runtime?.githubPagesUrl,
    runtime?.localPreviewServerUrl,
  ]);

  let mode: ImplementationPreviewEntryModeV1 = "disabled";
  if (integratedReady) {
    mode = "integrated_app_preview";
    if (!url) {
      url = buildIntegratedAppPreviewFallbackUrl(pid);
    }
  } else if (input.controlPlanePreviewReady || input.prototypeRunPreviewReady || runtime?.status === "ready") {
    mode = "codetask_result_preview";
    if (!url) {
      url = buildCodeTaskPreviewFallbackUrl(pid);
    }
  }

  const ready =
    integratedReady ||
    input.controlPlanePreviewReady === true ||
    input.prototypeRunPreviewReady === true ||
    runtime?.status === "ready";

  const showToolbarIcon = ready && Boolean(url?.trim());
  return {
    showToolbarIcon,
    enabled: showToolbarIcon,
    url: url?.trim() || null,
    mode: showToolbarIcon ? mode : "disabled",
  };
}

export function toAbsolutePreviewViewerUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (typeof window !== "undefined" && trimmed.startsWith("/")) {
    return `${window.location.origin}${trimmed}`;
  }
  return trimmed;
}
