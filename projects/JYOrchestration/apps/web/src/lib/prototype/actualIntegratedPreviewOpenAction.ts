import { sanitizeIntegratedAppPreviewUrl } from "@/lib/prototype/implementationPreviewEntryPolicy";

export function openActualIntegratedPreviewInNewWindow(input: {
  readonly projectId: string;
  readonly url: string;
}): boolean {
  const pid = input.projectId.trim();
  const url = sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: input.url });
  if (!url) {
    console.info(
      JSON.stringify({
        action: "actual_preview_open_blocked",
        projectId: pid || null,
        runtimeKind: "actual_integrated_app",
        previewReady: false,
        actualPreviewUrlPresent: false,
        buttonKind: "actual_integrated_preview",
      }),
    );
    return false;
  }
  console.info(
    JSON.stringify({
      action: "actual_preview_open_requested",
      projectId: pid || null,
      runtimeKind: "actual_integrated_app",
      previewReady: true,
      actualPreviewUrlPresent: true,
      buttonKind: "actual_integrated_preview",
    }),
  );
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export function logDiagnosticPreviewOpenRequested(input: {
  readonly projectId: string;
  readonly diagnosticPreviewUrlPresent: boolean;
}): void {
  console.info(
    JSON.stringify({
      action: "diagnostic_preview_open_requested",
      projectId: input.projectId.trim() || null,
      runtimeKind: "codetask_diagnostic",
      diagnosticPreviewUrlPresent: input.diagnosticPreviewUrlPresent,
      buttonKind: "codetask_diagnostic_preview",
    }),
  );
}
