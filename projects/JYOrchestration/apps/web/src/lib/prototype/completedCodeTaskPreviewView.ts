import type { ImplementationPreviewRenderModeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";

export type CompletedCodeTaskPreviewMainMode = "iframe" | "scope_summary_fallback";

export function resolveCompletedCodeTaskPreviewMainMode(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): CompletedCodeTaskPreviewMainMode {
  if (!runtime || runtime.status !== "ready") return "scope_summary_fallback";
  const mode = runtime.renderMode ?? "scope_summary_fallback";
  if (mode === "scope_summary_fallback") return "scope_summary_fallback";
  const appUrl = String(runtime.appPreviewUrl ?? "").trim();
  if (!appUrl) return "scope_summary_fallback";
  return "iframe";
}

export function shouldShowPreviewFallbackNotice(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): boolean {
  if (!runtime || runtime.status !== "ready") return false;
  return runtime.renderMode === "scope_summary_fallback";
}

export function normalizePreviewRenderMode(
  raw: unknown,
  appPreviewUrl: string | null | undefined,
): ImplementationPreviewRenderModeV1 {
  const mode = String(raw ?? "").trim();
  if (mode === "generated_app" || mode === "generated_app_iframe" || mode === "scope_summary_fallback") {
    return mode;
  }
  return String(appPreviewUrl ?? "").trim() ? "generated_app_iframe" : "scope_summary_fallback";
}
