import {
  isExternalPreviewUrl,
  isInternalPreviewPath,
} from "@/lib/prototype/previewUrlClassification";
import {
  normalizePreviewOpenMode,
  normalizePreviewRenderMode,
} from "@/lib/prototype/completedCodeTaskPreviewView";
import {
  IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
  type ImplementationPreviewScopeV1,
} from "@/lib/prototype/implementationPreviewScopeV1";

export const IMPLEMENTATION_PREVIEW_RUNTIME_VERSION = "implementation_preview_runtime_v1" as const;

export type ImplementationPreviewRuntimeStatus =
  | "not_started"
  | "building"
  | "ready"
  | "failed";

export type ImplementationPreviewOpenModeV1 =
  | "external_new_window"
  | "internal_renderer"
  | "scope_summary_fallback";

export type ImplementationPreviewRenderModeV1 =
  | "external_preview"
  | "generated_app"
  | "internal_generated_app"
  | "generated_app_iframe"
  | "scope_summary_fallback";

export type ImplementationPreviewRuntimeV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_PREVIEW_RUNTIME_VERSION;
  readonly status: ImplementationPreviewRuntimeStatus;
  readonly generatedAt?: string | null;
  readonly previewUrl?: string | null;
  readonly appPreviewUrl?: string | null;
  readonly externalPreviewUrl?: string | null;
  readonly internalAppPreviewUrl?: string | null;
  readonly sourceScopeVersion: typeof IMPLEMENTATION_PREVIEW_SCOPE_VERSION;
  readonly renderMode: ImplementationPreviewRenderModeV1;
  readonly openMode: ImplementationPreviewOpenModeV1;
  readonly includedCodeTaskIds: readonly string[];
  readonly excludedCodeTaskIds: readonly string[];
  readonly warnings: readonly string[];
  readonly errorMessage?: string | null;
  /** P3-M44: Preview/GitHub 통합 branch SoT */
  readonly sourceIntegrationBranch?: string | null;
}>;

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

export function buildPreviewUrlForCompletedCodeTaskScope(projectId: string): string {
  const pid = projectId.trim();
  return `/projects/${encodeURIComponent(pid)}/preview?scope=latest`;
}

export function parseImplementationPreviewRuntimeV1(
  raw: unknown,
): ImplementationPreviewRuntimeV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== IMPLEMENTATION_PREVIEW_RUNTIME_VERSION) return null;
  const status = readString(o.status) as ImplementationPreviewRuntimeStatus;
  if (!["not_started", "building", "ready", "failed"].includes(status)) return null;
  const sourceScopeVersion = readString(o.sourceScopeVersion);
  if (sourceScopeVersion !== IMPLEMENTATION_PREVIEW_SCOPE_VERSION) return null;

  const includedCodeTaskIds = Array.isArray(o.includedCodeTaskIds)
    ? o.includedCodeTaskIds.map((id) => readString(id)).filter(Boolean)
    : [];
  const excludedCodeTaskIds = Array.isArray(o.excludedCodeTaskIds)
    ? o.excludedCodeTaskIds.map((id) => readString(id)).filter(Boolean)
    : [];
  const warnings = Array.isArray(o.warnings)
    ? o.warnings.map((w) => readString(w)).filter(Boolean)
    : [];

  const appPreviewUrl = readString(o.appPreviewUrl) || null;
  const externalPreviewUrl = readString(o.externalPreviewUrl) || null;
  const internalAppPreviewUrl =
    readString(o.internalAppPreviewUrl) ||
    (appPreviewUrl && isInternalPreviewPath(appPreviewUrl) ? appPreviewUrl : null) ||
    null;

  const inferredExternal =
    externalPreviewUrl ||
    (appPreviewUrl && isExternalPreviewUrl(appPreviewUrl) ? appPreviewUrl : null) ||
    null;

  const renderMode = normalizePreviewRenderMode(o.renderMode, {
    appPreviewUrl,
    externalPreviewUrl: inferredExternal,
    internalAppPreviewUrl,
  });
  const openMode = normalizePreviewOpenMode(o.openMode, {
    renderMode,
    externalPreviewUrl: inferredExternal,
    internalAppPreviewUrl,
    previewUrl: readString(o.previewUrl) || null,
  });

  const compatibilityAppPreviewUrl =
    inferredExternal ?? internalAppPreviewUrl ?? appPreviewUrl ?? null;

  return {
    version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
    status,
    sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
    renderMode,
    openMode,
    includedCodeTaskIds,
    excludedCodeTaskIds,
    warnings,
    ...(readString(o.generatedAt) ? { generatedAt: readString(o.generatedAt) } : {}),
    ...(readString(o.previewUrl) ? { previewUrl: readString(o.previewUrl) } : {}),
    ...(compatibilityAppPreviewUrl ? { appPreviewUrl: compatibilityAppPreviewUrl } : {}),
    ...(inferredExternal ? { externalPreviewUrl: inferredExternal } : {}),
    ...(internalAppPreviewUrl ? { internalAppPreviewUrl } : {}),
    ...(readString(o.errorMessage) ? { errorMessage: readString(o.errorMessage) } : {}),
    ...(readString(o.sourceIntegrationBranch)
      ? { sourceIntegrationBranch: readString(o.sourceIntegrationBranch) }
      : {}),
  };
}

export function isImplementationPreviewRuntimeReady(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): boolean {
  if (!runtime || runtime.status !== "ready") return false;
  const previewUrl = String(runtime.previewUrl ?? "").trim();
  const internal = String(runtime.internalAppPreviewUrl ?? "").trim();
  const external = String(runtime.externalPreviewUrl ?? "").trim();
  return Boolean(previewUrl || internal || external);
}
