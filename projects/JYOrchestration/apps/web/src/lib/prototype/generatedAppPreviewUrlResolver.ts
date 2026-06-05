import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import type { ImplementationPreviewRenderModeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";

export type ResolveGeneratedAppPreviewUrlResult = Readonly<{
  readonly ok: boolean;
  readonly appPreviewUrl?: string | null;
  readonly renderMode: ImplementationPreviewRenderModeV1;
  readonly reason?: string | null;
  readonly warnings: readonly string[];
}>;

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

export function buildInternalGeneratedAppPreviewUrl(projectId: string): string {
  const pid = projectId.trim();
  return `/projects/${encodeURIComponent(pid)}/preview/app?scope=latest`;
}

function isHttpPreviewUrl(url: string): boolean {
  const u = url.trim();
  return /^https?:\/\//i.test(u);
}

function readExternalPreviewFromSettings(projectPreviewSettings: unknown): string | null {
  if (!projectPreviewSettings || typeof projectPreviewSettings !== "object") return null;
  const o = projectPreviewSettings as Record<string, unknown>;
  for (const key of ["previewUrl", "appPreviewUrl", "publicUrl", "suggestedPreviewUrl"] as const) {
    const value = readString(o[key]);
    if (isHttpPreviewUrl(value)) return value;
  }
  return null;
}

/** completed CodeTask scope 기준으로 실제 앱 iframe URL을 결정한다. */
export function resolveGeneratedAppPreviewUrl(input: {
  readonly projectId: string;
  readonly targetRepository?: string | null;
  readonly previewScope: ImplementationPreviewScopeV1;
  readonly completedCodeTaskCount: number;
  readonly projectPreviewSettings?: unknown;
  readonly externalPreviewUrl?: string | null;
}): ResolveGeneratedAppPreviewUrlResult {
  const warnings: string[] = [...input.previewScope.warnings];
  const pid = input.projectId.trim();
  const external =
    (readString(input.externalPreviewUrl) && isHttpPreviewUrl(readString(input.externalPreviewUrl))
      ? readString(input.externalPreviewUrl)
      : null) ?? readExternalPreviewFromSettings(input.projectPreviewSettings);

  if (external) {
    return {
      ok: true,
      appPreviewUrl: external,
      renderMode: "generated_app_iframe",
      warnings,
    };
  }

  if (input.completedCodeTaskCount > 0 && pid) {
    return {
      ok: true,
      appPreviewUrl: buildInternalGeneratedAppPreviewUrl(pid),
      renderMode: "generated_app_iframe",
      warnings,
    };
  }

  void input.targetRepository;

  return {
    ok: false,
    appPreviewUrl: null,
    renderMode: "scope_summary_fallback",
    reason: "generated_app_preview_url_unavailable",
    warnings,
  };
}
