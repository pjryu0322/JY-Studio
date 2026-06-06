import type {
  ImplementationPreviewOpenModeV1,
  ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";

export type PreviewOpenTarget = Readonly<{
  readonly url: string | null;
  readonly mode: "new_window" | "internal";
  readonly label: string;
  readonly hint: string | null;
}>;

export function getPreviewOpenTarget(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): PreviewOpenTarget {
  const wrapperUrl = String(runtime?.previewUrl ?? "").trim() || null;
  const external = String(runtime?.externalPreviewUrl ?? "").trim() || null;
  const internalApp = String(runtime?.internalAppPreviewUrl ?? "").trim() || null;
  const openMode: ImplementationPreviewOpenModeV1 =
    runtime?.openMode ??
    (external ? "external_new_window" : wrapperUrl ? "internal_renderer" : "scope_summary_fallback");

  if (openMode === "external_new_window" && external) {
    return {
      url: external,
      mode: "new_window",
      label: "Preview 열기",
      hint: "GitHub Pages Preview를 새 창으로 엽니다.",
    };
  }

  if (internalApp) {
    return {
      url: internalApp,
      mode: "new_window",
      label: "내부 Preview 보기",
      hint: "플랫폼 내부 Preview Renderer로 확인합니다.",
    };
  }

  if (wrapperUrl) {
    return {
      url: wrapperUrl,
      mode: "new_window",
      label: "Preview 열기",
      hint: null,
    };
  }

  return {
    url: null,
    mode: "internal",
    label: "Preview 보기",
    hint: "Preview URL이 아직 준비되지 않았습니다.",
  };
}

export function getPreviewScopeViewUrl(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): string | null {
  return String(runtime?.previewUrl ?? "").trim() || null;
}
