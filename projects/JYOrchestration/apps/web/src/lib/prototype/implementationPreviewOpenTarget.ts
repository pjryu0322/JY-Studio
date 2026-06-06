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

export type PreviewOpenTargetInput = Readonly<{
  readonly runtime: ImplementationPreviewRuntimeV1 | null | undefined;
  readonly canIntegrate?: boolean;
}>;

export const PRE_INTEGRATION_PREVIEW_HINT =
  "통합을 실행하면 완료된 CodeTask 기준 Preview가 준비됩니다." as const;

export const PREVIEW_URL_NOT_READY_HINT = "Preview URL이 아직 준비되지 않았습니다." as const;

function resolvePreviewOpenTargetFromRuntime(
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

  if (runtime?.status === "failed") {
    const reason = String(runtime.errorMessage ?? "").trim();
    return {
      url: null,
      mode: "internal",
      label: "Preview 보기",
      hint: reason ? `Preview 준비 실패: ${reason}` : PREVIEW_URL_NOT_READY_HINT,
    };
  }

  return {
    url: null,
    mode: "internal",
    label: "Preview 보기",
    hint: PREVIEW_URL_NOT_READY_HINT,
  };
}

export function getPreviewOpenTarget(
  runtimeOrInput: ImplementationPreviewRuntimeV1 | null | undefined | PreviewOpenTargetInput,
  legacyCanIntegrate?: boolean,
): PreviewOpenTarget {
  if (runtimeOrInput && typeof runtimeOrInput === "object" && "runtime" in runtimeOrInput) {
    const input = runtimeOrInput as PreviewOpenTargetInput;
    const target = resolvePreviewOpenTargetFromRuntime(input.runtime);
    if (!target.url && input.canIntegrate && input.runtime?.status !== "failed") {
      return { ...target, hint: PRE_INTEGRATION_PREVIEW_HINT };
    }
    return target;
  }
  const runtime = runtimeOrInput as ImplementationPreviewRuntimeV1 | null | undefined;
  const target = resolvePreviewOpenTargetFromRuntime(runtime);
  if (!target.url && legacyCanIntegrate && runtime?.status !== "failed") {
    return { ...target, hint: PRE_INTEGRATION_PREVIEW_HINT };
  }
  return target;
}

export function getPreviewScopeViewUrl(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): string | null {
  return String(runtime?.previewUrl ?? "").trim() || null;
}
