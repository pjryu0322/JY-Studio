import { isExternalPreviewUrl, isInternalPreviewPath } from "@/lib/prototype/previewUrlClassification";
import type {
  ImplementationPreviewOpenModeV1,
  ImplementationPreviewRenderModeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { canIframeInternalAppPreviewUrl } from "@/lib/prototype/generatedAppPreviewUrlResolver";

export type CompletedCodeTaskPreviewMainMode =
  | "internal_iframe"
  | "external_launch"
  | "scope_summary_fallback";

export function resolveCompletedCodeTaskPreviewMainMode(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): CompletedCodeTaskPreviewMainMode {
  if (!runtime || runtime.status !== "ready") return "scope_summary_fallback";

  if (runtime.openMode === "external_new_window") {
    return "external_launch";
  }

  if (runtime.openMode === "scope_summary_fallback" || runtime.renderMode === "scope_summary_fallback") {
    return "scope_summary_fallback";
  }

  const renderMode = String(runtime.renderMode ?? "");
  const integratedRender =
    renderMode === "internal_generated_app" ||
    renderMode === "generated_app" ||
    renderMode === "external_preview" ||
    renderMode === "internal_app";

  const internalUrl =
    String(runtime.internalAppPreviewUrl ?? "").trim() ||
    (runtime.appPreviewUrl && isInternalPreviewPath(runtime.appPreviewUrl)
      ? String(runtime.appPreviewUrl).trim()
      : "");

  if (
    (runtime.openMode === "internal_renderer" || integratedRender) &&
    internalUrl &&
    canIframeInternalAppPreviewUrl(internalUrl)
  ) {
    return "internal_iframe";
  }

  if (
    integratedRender &&
    String(runtime.sourceIntegrationBranch ?? "").trim() &&
    internalUrl
  ) {
    return "internal_iframe";
  }

  return "scope_summary_fallback";
}

export function resolveInternalIframeSrc(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): string | null {
  if (!runtime || runtime.status !== "ready") return null;
  if (runtime.openMode === "external_new_window") return null;

  const internalUrl = String(runtime.internalAppPreviewUrl ?? "").trim();
  if (internalUrl && canIframeInternalAppPreviewUrl(internalUrl)) return internalUrl;
  const legacy = String(runtime?.appPreviewUrl ?? "").trim();
  if (legacy && isInternalPreviewPath(legacy) && canIframeInternalAppPreviewUrl(legacy)) return legacy;
  return null;
}

export function shouldShowPreviewFallbackNotice(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): boolean {
  if (!runtime || runtime.status !== "ready") return false;
  return (
    runtime.openMode === "scope_summary_fallback" || runtime.renderMode === "scope_summary_fallback"
  );
}

export function isIntegratedAppPreviewPagePresentation(input: {
  readonly runtime: ImplementationPreviewRuntimeV1 | null | undefined;
  readonly mainMode: CompletedCodeTaskPreviewMainMode;
}): boolean {
  const runtime = input.runtime;
  if (!runtime || runtime.status !== "ready") return false;
  if (input.mainMode === "scope_summary_fallback") return false;
  if (runtime.renderMode === "scope_summary_fallback") return false;
  if (runtime.openMode === "scope_summary_fallback") return false;
  return input.mainMode === "internal_iframe" || input.mainMode === "external_launch";
}

export function resolveCompletedCodeTaskPreviewPageHeader(input: {
  readonly scopeIncludedCount: number;
  readonly scopeExcludedCount: number;
  readonly runtime: ImplementationPreviewRuntimeV1 | null | undefined;
  readonly mainMode: CompletedCodeTaskPreviewMainMode;
}): Readonly<{
  readonly title: string;
  readonly subtitle: string | null;
  readonly showScopeDetails: boolean;
}> {
  if (
    isIntegratedAppPreviewPagePresentation({
      runtime: input.runtime,
      mainMode: input.mainMode,
    })
  ) {
    return {
      title: "실제 앱 Preview",
      subtitle: null,
      showScopeDetails: false,
    };
  }
  return {
    title: `Preview · 완료된 CodeTask ${input.scopeIncludedCount}개 기준`,
    subtitle:
      input.scopeExcludedCount > 0
        ? `미완료 CodeTask ${input.scopeExcludedCount}개 제외`
        : "제외된 CodeTask 없음",
    showScopeDetails: true,
  };
}

export function normalizePreviewRenderMode(
  raw: unknown,
  urls: {
    readonly appPreviewUrl: string | null;
    readonly externalPreviewUrl: string | null;
    readonly internalAppPreviewUrl: string | null;
  },
): ImplementationPreviewRenderModeV1 {
  const mode = String(raw ?? "").trim();
  if (
    mode === "external_preview" ||
    mode === "generated_app" ||
    mode === "internal_generated_app" ||
    mode === "scope_summary_fallback"
  ) {
    return mode;
  }
  if (mode === "generated_app_iframe") {
    if (urls.externalPreviewUrl || (urls.appPreviewUrl && isExternalPreviewUrl(urls.appPreviewUrl))) {
      return "external_preview";
    }
    return "internal_generated_app";
  }
  if (urls.externalPreviewUrl || (urls.appPreviewUrl && isExternalPreviewUrl(urls.appPreviewUrl))) {
    return "external_preview";
  }
  if (urls.internalAppPreviewUrl || (urls.appPreviewUrl && isInternalPreviewPath(urls.appPreviewUrl))) {
    return "internal_generated_app";
  }
  return "scope_summary_fallback";
}

export function normalizePreviewOpenMode(
  raw: unknown,
  input: {
    readonly renderMode: ImplementationPreviewRenderModeV1;
    readonly externalPreviewUrl: string | null;
    readonly internalAppPreviewUrl: string | null;
    readonly previewUrl: string | null;
  },
): ImplementationPreviewOpenModeV1 {
  const mode = String(raw ?? "").trim();
  if (
    mode === "external_new_window" ||
    mode === "internal_renderer" ||
    mode === "scope_summary_fallback"
  ) {
    return mode;
  }
  if (input.externalPreviewUrl) return "external_new_window";
  if (input.renderMode === "scope_summary_fallback") return "scope_summary_fallback";
  if (input.internalAppPreviewUrl || input.previewUrl) return "internal_renderer";
  return "scope_summary_fallback";
}
