import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewOpenModeV1,
  type ImplementationPreviewRenderModeV1,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";
import { isExternalPreviewUrl, isHttpUrl } from "@/lib/prototype/previewUrlClassification";

export type ActualIntegratedAppPreviewTargetV1 = Readonly<{
  readonly ok: boolean;
  readonly previewUrl: string | null;
  readonly externalPreviewUrl: string | null;
  readonly internalPreviewUrl: string | null;
  readonly integrationBranch: string | null;
  readonly appEntryPath: string | null;
  readonly runtimeKind: "actual_integrated_app";
  readonly openMode: "internal_renderer" | "external_new_window";
  readonly reason?: string | null;
  readonly warnings: readonly string[];
}>;

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function readLocalPreviewServerUrl(projectPreviewSettings: unknown): string | null {
  if (!projectPreviewSettings || typeof projectPreviewSettings !== "object") return null;
  const o = projectPreviewSettings as Record<string, unknown>;
  for (const key of ["localPreviewServerUrl", "previewServerUrl", "devServerUrl"] as const) {
    const value = readString(o[key]);
    if (value && isHttpUrl(value)) return value;
  }
  return null;
}

function readExternalFromSettings(projectPreviewSettings: unknown): string | null {
  if (!projectPreviewSettings || typeof projectPreviewSettings !== "object") return null;
  const o = projectPreviewSettings as Record<string, unknown>;
  for (const key of [
    "externalPreviewUrl",
    "githubPagesUrl",
    "publicUrl",
    "previewUrl",
    "appPreviewUrl",
  ] as const) {
    const value = readString(o[key]);
    if (value && isExternalPreviewUrl(value)) return value;
  }
  return null;
}

export function resolveActualIntegratedAppPreviewTarget(input: {
  readonly projectId: string;
  readonly integrationBranch: string | null;
  readonly integrationPlan: CodeTaskIntegrationPlanV1 | null;
  readonly projectPreviewSettings?: unknown;
  readonly appEntryPath?: string | null;
  readonly externalPreviewUrl?: string | null;
  readonly localPreviewServerUrl?: string | null;
}): ActualIntegratedAppPreviewTargetV1 {
  const warnings: string[] = [];
  const pid = input.projectId.trim();
  const integrationBranch =
    readString(input.integrationBranch) ||
    readString(input.integrationPlan?.integrationBranch) ||
    null;

  const external =
    readString(input.externalPreviewUrl) ||
    readExternalFromSettings(input.projectPreviewSettings) ||
    null;
  if (external && isExternalPreviewUrl(external)) {
    return {
      ok: true,
      previewUrl: external,
      externalPreviewUrl: external,
      internalPreviewUrl: null,
      integrationBranch,
      appEntryPath: readString(input.appEntryPath) || null,
      runtimeKind: "actual_integrated_app",
      openMode: "external_new_window",
      warnings,
    };
  }

  const local =
    readString(input.localPreviewServerUrl) ||
    readLocalPreviewServerUrl(input.projectPreviewSettings) ||
    null;
  if (local && isHttpUrl(local)) {
    return {
      ok: true,
      previewUrl: local,
      externalPreviewUrl: null,
      internalPreviewUrl: local,
      integrationBranch,
      appEntryPath: readString(input.appEntryPath) || local,
      runtimeKind: "actual_integrated_app",
      openMode: "internal_renderer",
      warnings,
    };
  }

  if (integrationBranch) {
    return {
      ok: false,
      previewUrl: null,
      externalPreviewUrl: null,
      internalPreviewUrl: null,
      integrationBranch,
      appEntryPath: readString(input.appEntryPath) || null,
      runtimeKind: "actual_integrated_app",
      openMode: "internal_renderer",
      reason:
        "통합 branch는 확인됐지만 실행 가능한 Preview URL(배포 URL 또는 preview server)이 아직 없습니다.",
      warnings,
    };
  }

  return {
    ok: false,
    previewUrl: null,
    externalPreviewUrl: null,
    internalPreviewUrl: null,
    integrationBranch: null,
    appEntryPath: null,
    runtimeKind: "actual_integrated_app",
    openMode: "internal_renderer",
    reason: pid
      ? "통합 branch 또는 실제 앱 Preview URL을 확인하지 못했습니다."
      : "프로젝트를 선택해 주세요.",
    warnings,
  };
}

export function buildActualIntegratedAppPreviewRuntime(input: {
  readonly projectId: string;
  readonly target: ActualIntegratedAppPreviewTargetV1;
  readonly nowIso: string;
}): ImplementationPreviewRuntimeV1 {
  const target = input.target;
  const openMode: ImplementationPreviewOpenModeV1 =
    target.openMode === "external_new_window" ? "external_new_window" : "internal_renderer";
  const renderMode: ImplementationPreviewRenderModeV1 = target.externalPreviewUrl
    ? "external_preview"
    : "internal_app";

  return {
    version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
    status: "ready",
    generatedAt: input.nowIso,
    previewUrl: target.previewUrl,
    appPreviewUrl: target.previewUrl,
    externalPreviewUrl: target.externalPreviewUrl,
    internalAppPreviewUrl: target.internalPreviewUrl,
    localPreviewServerUrl: target.internalPreviewUrl,
    sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
    renderMode,
    openMode,
    runtimeKind: "actual_integrated_app",
    includedCodeTaskIds: [],
    excludedCodeTaskIds: [],
    warnings: [...target.warnings],
    errorMessage: null,
    sourceIntegrationBranch: target.integrationBranch,
  };
}
