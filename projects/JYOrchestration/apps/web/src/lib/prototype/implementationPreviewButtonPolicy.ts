import { resolveImplementationAppPreviewTarget } from "@/lib/prototype/implementationAppPreviewTarget";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { getCodeTaskDiagnosticPreviewOpenTarget } from "@/lib/prototype/implementationPreviewOpenTarget";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

export type ImplementationPreviewButtonModeV1 =
  | "integrated_app_preview"
  | "codetask_result_preview"
  | "disabled";

export type ImplementationPreviewButtonStateV1 = Readonly<{
  readonly show: boolean;
  readonly enabled: boolean;
  readonly label: "Preview";
  readonly mode: ImplementationPreviewButtonModeV1;
  readonly url: string | null;
  readonly userMessage: string;
  readonly disabledReason: string | null;
}>;

export function buildIntegratedAppPreviewFallbackUrl(projectId: string): string {
  const pid = projectId.trim();
  return `/projects/${encodeURIComponent(pid)}/preview/app?scope=latest`;
}

export function buildCodeTaskPreviewFallbackUrl(projectId: string): string {
  const pid = projectId.trim();
  return `/projects/${encodeURIComponent(pid)}/preview?scope=latest`;
}

function resolveIntegratedAppPreviewUrl(input: {
  readonly projectId: string;
  readonly snapshot: ImplementationRuntimeSnapshotV1;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
}): string {
  const runtime = input.previewRuntime ?? null;
  const external = String(runtime?.externalPreviewUrl ?? "").trim();
  if (external) return external;
  const internal = String(runtime?.internalAppPreviewUrl ?? "").trim();
  if (internal) return internal;
  const appTarget = resolveImplementationAppPreviewTarget({
    projectId: input.projectId,
    runtime,
    integrationPlan: null,
    finalWiringCodeTaskId: null,
  });
  if (appTarget.externalPreviewUrl?.trim()) return appTarget.externalPreviewUrl.trim();
  if (appTarget.appEntryPath?.trim()) {
    return buildIntegratedAppPreviewFallbackUrl(input.projectId);
  }
  const snapshotUrl = String(input.snapshot.preview.previewUrl ?? "").trim();
  if (snapshotUrl && snapshotUrl.includes("/preview/app")) return snapshotUrl;
  return buildIntegratedAppPreviewFallbackUrl(input.projectId);
}

export function evaluateImplementationPreviewButtonState(input: {
  readonly projectId: string;
  readonly snapshot: ImplementationRuntimeSnapshotV1;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly codeTaskPreviewReady?: boolean;
  readonly integratedAppPreviewReady?: boolean;
}): ImplementationPreviewButtonStateV1 {
  const pid = input.projectId.trim();
  const integratedReady =
    input.integratedAppPreviewReady === true ||
    input.snapshot.preview.integratedAppPreviewReady;
  const codeTaskReady =
    input.codeTaskPreviewReady === true || input.snapshot.preview.codeTaskPreviewReady;

  if (integratedReady) {
    return {
      show: true,
      enabled: true,
      label: "Preview",
      mode: "integrated_app_preview",
      url: resolveIntegratedAppPreviewUrl(input),
      userMessage: "Preview 버튼을 눌러 실제 앱 화면을 확인할 수 있습니다.",
      disabledReason: null,
    };
  }

  const { failed, inconsistent, selected } = input.snapshot.codeTask;
  if (failed > 0 || inconsistent > 0) {
    return {
      show: true,
      enabled: false,
      label: "Preview",
      mode: "disabled",
      url: null,
      userMessage: "Preview를 준비할 수 없습니다.\n미완료 또는 실패한 CodeTask를 먼저 처리해 주세요.",
      disabledReason: "실패 또는 검증 불일치 CodeTask가 있습니다.",
    };
  }

  if (codeTaskReady) {
    const diagnostic = getCodeTaskDiagnosticPreviewOpenTarget({
      runtime: input.previewRuntime,
      codeTaskPreviewReady: true,
    });
    const url =
      diagnostic.url?.trim() ||
      (pid ? buildCodeTaskPreviewFallbackUrl(pid) : null);
    return {
      show: true,
      enabled: Boolean(url),
      label: "Preview",
      mode: "codetask_result_preview",
      url,
      userMessage:
        "현재는 CodeTask 결과 미리보기입니다.\n실제 앱 Preview는 통합 및 Preview 준비가 완료된 후 열 수 있습니다.",
      disabledReason: url ? null : "Preview URL이 아직 없습니다.",
    };
  }

  return {
    show: true,
    enabled: false,
    label: "Preview",
    mode: "disabled",
    url: null,
    userMessage: "Preview를 준비할 수 없습니다.\n미완료 또는 실패한 CodeTask를 먼저 처리해 주세요.",
    disabledReason: selected > 0 ? "완료된 CodeTask가 없습니다." : "선택된 CodeTask가 없습니다.",
  };
}

export function shouldSuppressIntegrationContinueUserMessage(input: {
  readonly status?: string | null;
  readonly previewReady?: boolean | null;
  readonly integratedAppPreviewReady?: boolean | null;
  readonly message?: string | null;
}): boolean {
  if (input.previewReady === true) return true;
  if (input.integratedAppPreviewReady === true) return true;
  if (String(input.status ?? "").trim() === "integrated_app_preview_ready") return true;
  return false;
}
