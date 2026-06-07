import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";

export function shouldShowIntegrationPipelineButton(input: {
  readonly canIntegrate: boolean;
  readonly previewRuntimeReady?: boolean;
}): boolean {
  if (!input.canIntegrate) return false;
  if (input.previewRuntimeReady) return false;
  return true;
}

export function isPreviewRuntimeOpenReady(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): boolean {
  if (!runtime || runtime.status !== "ready") return false;
  return Boolean(
    String(runtime.externalPreviewUrl ?? "").trim() ||
      String(runtime.previewUrl ?? "").trim() ||
      String(runtime.internalAppPreviewUrl ?? "").trim(),
  );
}

export function isIntegrationPreviewRuntimeReady(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): boolean {
  if (!isPreviewRuntimeOpenReady(runtime)) return false;
  if (
    runtime!.openMode === "scope_summary_fallback" ||
    runtime!.renderMode === "scope_summary_fallback"
  ) {
    return false;
  }
  if (!String(runtime!.sourceIntegrationBranch ?? "").trim()) return false;
  return runtime!.status === "ready";
}
