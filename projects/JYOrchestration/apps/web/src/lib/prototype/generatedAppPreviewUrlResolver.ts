import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import type {
  ImplementationPreviewOpenModeV1,
  ImplementationPreviewRenderModeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  isExternalPreviewUrl,
  isHttpUrl,
  isInternalPreviewPath,
} from "@/lib/prototype/previewUrlClassification";

export type ResolveGeneratedAppPreviewUrlResult = Readonly<{
  readonly ok: boolean;
  readonly externalPreviewUrl?: string | null;
  readonly internalAppPreviewUrl?: string | null;
  readonly appPreviewUrl?: string | null;
  readonly renderMode: ImplementationPreviewRenderModeV1;
  readonly openMode: ImplementationPreviewOpenModeV1;
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

function readExternalPreviewFromSettings(projectPreviewSettings: unknown): string | null {
  if (!projectPreviewSettings || typeof projectPreviewSettings !== "object") return null;
  const o = projectPreviewSettings as Record<string, unknown>;
  for (const key of [
    "externalPreviewUrl",
    "githubPagesUrl",
    "publicUrl",
    "previewUrl",
    "appPreviewUrl",
    "suggestedPreviewUrl",
  ] as const) {
    const value = readString(o[key]);
    if (isExternalPreviewUrl(value)) return value;
  }
  return null;
}

function pickExternalCandidate(input: {
  readonly externalPreviewUrl?: string | null;
  readonly projectPreviewSettings?: unknown;
}): string | null {
  const direct = readString(input.externalPreviewUrl);
  if (direct && isExternalPreviewUrl(direct)) return direct;
  return readExternalPreviewFromSettings(input.projectPreviewSettings);
}

/** completed CodeTask scope 기준으로 외부/내부 Preview URL을 분리해 결정한다. */
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
  void input.targetRepository;

  const external = pickExternalCandidate(input);
  if (external) {
    return {
      ok: true,
      externalPreviewUrl: external,
      internalAppPreviewUrl: pid ? buildInternalGeneratedAppPreviewUrl(pid) : null,
      appPreviewUrl: external,
      renderMode: "external_preview",
      openMode: "external_new_window",
      warnings,
    };
  }

  if (input.completedCodeTaskCount > 0 && pid) {
    const internalAppPreviewUrl = buildInternalGeneratedAppPreviewUrl(pid);
    return {
      ok: true,
      externalPreviewUrl: null,
      internalAppPreviewUrl,
      appPreviewUrl: internalAppPreviewUrl,
      renderMode: "internal_generated_app",
      openMode: "internal_renderer",
      warnings,
    };
  }

  return {
    ok: false,
    externalPreviewUrl: null,
    internalAppPreviewUrl: null,
    appPreviewUrl: null,
    renderMode: "scope_summary_fallback",
    openMode: "scope_summary_fallback",
    reason: "generated_app_preview_url_unavailable",
    warnings,
  };
}

export { isExternalPreviewUrl, isGithubPagesPreviewUrl } from "@/lib/prototype/previewUrlClassification";

export function canIframeInternalAppPreviewUrl(url: string | null | undefined): boolean {
  const u = readString(url);
  if (!u) return false;
  if (isExternalPreviewUrl(u)) return false;
  return isInternalPreviewPath(u);
}
