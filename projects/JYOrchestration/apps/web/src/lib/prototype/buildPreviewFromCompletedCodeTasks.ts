import {
  buildPreviewUrlForCompletedCodeTaskScope,
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
  type ImplementationPreviewScopeV1,
} from "@/lib/prototype/implementationPreviewScopeV1";
import { resolveGeneratedAppPreviewUrl } from "@/lib/prototype/generatedAppPreviewUrlResolver";

export type BuildPreviewFromCompletedCodeTasksResult = Readonly<{
  readonly ok: boolean;
  readonly runtime: ImplementationPreviewRuntimeV1;
  readonly previewUrl?: string | null;
  readonly errorMessage?: string | null;
}>;

function failedRuntime(input: {
  readonly previewScope: ImplementationPreviewScopeV1;
  readonly nowIso: string;
  readonly errorMessage: string;
}): ImplementationPreviewRuntimeV1 {
  return {
    version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
    status: "failed",
    generatedAt: input.nowIso,
    previewUrl: null,
    appPreviewUrl: null,
    externalPreviewUrl: null,
    internalAppPreviewUrl: null,
    renderMode: "scope_summary_fallback",
    openMode: "scope_summary_fallback",
    sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
    includedCodeTaskIds: input.previewScope.includedCodeTasks.map((row) => row.codeTaskId),
    excludedCodeTaskIds: input.previewScope.excludedCodeTasks.map((row) => row.codeTaskId),
    warnings: [...input.previewScope.warnings],
    errorMessage: input.errorMessage,
  };
}

/** Preview는 별도 배포 없이 scope 기준 내부 route URL만 준비한다. */
export function buildPreviewFromCompletedCodeTasks(input: {
  readonly projectId: string;
  readonly previewScope: ImplementationPreviewScopeV1;
  readonly nowIso?: string;
  readonly targetRepository?: string | null;
  readonly externalPreviewUrl?: string | null;
  readonly projectPreviewSettings?: unknown;
}): BuildPreviewFromCompletedCodeTasksResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const scope = input.previewScope;

  if (!scope.includedCodeTasks.length) {
    const errorMessage = "완료된 CodeTask가 없어 Preview를 준비할 수 없습니다.";
    return {
      ok: false,
      runtime: failedRuntime({ previewScope: scope, nowIso, errorMessage }),
      previewUrl: null,
      errorMessage,
    };
  }

  if (String(scope.version) !== IMPLEMENTATION_PREVIEW_SCOPE_VERSION) {
    const errorMessage = "Preview scope 버전이 올바르지 않습니다.";
    return {
      ok: false,
      runtime: failedRuntime({ previewScope: scope, nowIso, errorMessage }),
      previewUrl: null,
      errorMessage,
    };
  }

  if (!pid) {
    const errorMessage = "프로젝트를 선택해 주세요.";
    return {
      ok: false,
      runtime: failedRuntime({ previewScope: scope, nowIso, errorMessage }),
      previewUrl: null,
      errorMessage,
    };
  }

  const previewUrl = buildPreviewUrlForCompletedCodeTaskScope(pid);
  const appPreview = resolveGeneratedAppPreviewUrl({
    projectId: pid,
    targetRepository: input.targetRepository,
    previewScope: scope,
    completedCodeTaskCount: scope.includedCodeTasks.length,
    projectPreviewSettings: input.projectPreviewSettings,
    externalPreviewUrl: input.externalPreviewUrl,
  });

  const runtime: ImplementationPreviewRuntimeV1 = {
    version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
    status: "ready",
    generatedAt: nowIso,
    previewUrl,
    appPreviewUrl:
      appPreview.externalPreviewUrl ??
      appPreview.internalAppPreviewUrl ??
      appPreview.appPreviewUrl ??
      null,
    externalPreviewUrl: appPreview.externalPreviewUrl ?? null,
    internalAppPreviewUrl: appPreview.internalAppPreviewUrl ?? null,
    renderMode: appPreview.renderMode,
    openMode: appPreview.openMode,
    sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
    includedCodeTaskIds: scope.includedCodeTasks.map((row) => row.codeTaskId),
    excludedCodeTaskIds: scope.excludedCodeTasks.map((row) => row.codeTaskId),
    warnings: [...appPreview.warnings],
    errorMessage: null,
  };

  return { ok: true, runtime, previewUrl, errorMessage: null };
}

export async function buildPreviewFromCompletedCodeTasksAsync(input: {
  readonly projectId: string;
  readonly previewScope: ImplementationPreviewScopeV1;
  readonly nowIso?: string;
}): Promise<BuildPreviewFromCompletedCodeTasksResult> {
  return buildPreviewFromCompletedCodeTasks(input);
}
