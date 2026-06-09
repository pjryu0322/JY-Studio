import { isIntegratedAppRenderTarget } from "@/lib/prototype/implementationAppPreviewTarget";
import { isActualIntegratedAppPreviewRuntime } from "@/lib/prototype/implementationPreviewRuntimeKind";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type {
  ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { isExternalPreviewUrl } from "@/lib/prototype/previewUrlClassification";

export function buildIntegratedAppPreviewFallbackUrl(projectId: string): string {
  const pid = projectId.trim();
  return `/projects/${encodeURIComponent(pid)}/preview/app?scope=latest`;
}

export function buildCodeTaskPreviewFallbackUrl(projectId: string): string {
  const pid = projectId.trim();
  return `/projects/${encodeURIComponent(pid)}/preview?scope=latest`;
}

export type ImplementationPreviewEntryModeV1 =
  | "integrated_app_preview"
  | "codetask_result_preview"
  | "disabled";

export type ImplementationPreviewEntryStateV1 = Readonly<{
  readonly mode: ImplementationPreviewEntryModeV1;
  readonly enabled: boolean;
  readonly url: string | null;
  readonly openMode: "new_window" | "modal" | "none";
  readonly userMessage: string;
  readonly suppressNoticeModal: boolean;
}>;

function isCodetaskScopePreviewUrl(url: string | null | undefined): boolean {
  const u = String(url ?? "").trim();
  if (!u) return false;
  if (u.includes("/preview/app")) return false;
  return u.includes("/preview") && u.includes("scope=");
}

function isRuntimeIntegratedAppPreviewReadySignal(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
  projectId?: string | null,
): boolean {
  if (!runtime || runtime.status !== "ready") return false;
  if (
    !isActualIntegratedAppPreviewRuntime({
      projectId,
      runtime,
    })
  ) {
    return false;
  }
  if (runtime.openMode === "scope_summary_fallback" || runtime.renderMode === "scope_summary_fallback") {
    return false;
  }
  const external = String(runtime.externalPreviewUrl ?? "").trim();
  if (external) return true;
  const githubPages = String(runtime.githubPagesUrl ?? "").trim();
  if (githubPages && isExternalPreviewUrl(githubPages)) return true;
  const local = String(runtime.localPreviewServerUrl ?? "").trim();
  if (local) return true;
  const internal = String(runtime.internalAppPreviewUrl ?? "").trim();
  if (internal && !internal.includes("scope=latest")) return true;
  return false;
}

export function isLegacyCodeTaskPreviewScopeNoticeContent(content: string): boolean {
  const text = String(content ?? "").trim();
  if (!text) return false;
  return (
    /완료된 CodeTask\s*\d+개\s*기준/.test(text) ||
    text.includes("이번 Preview는 완료된 CodeTask") ||
    text.includes("미완료 기능은 포함되지 않았습니다") ||
    /제외:\s*\n-?\s*최종 연결\/통합 Wiring/.test(text) ||
    text.includes("Preview 준비를 계속 진행해야 합니다")
  );
}

export function sanitizeIntegratedAppPreviewUrl(input: {
  readonly projectId: string;
  readonly url: string | null | undefined;
}): string | null {
  const pid = input.projectId.trim();
  const raw = String(input.url ?? "").trim();
  if (!pid) return raw || null;
  if (!raw) return null;
  if (isCodetaskScopePreviewUrl(raw)) return null;
  if (raw.includes("/preview/app") && raw.includes("scope=latest")) return null;
  return raw;
}

export function resolveImplementationPreviewIntegratedReady(input: {
  readonly projectId: string;
  readonly snapshot: ImplementationRuntimeSnapshotV1;
  readonly integratedAppPreviewReady?: boolean;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly integrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly pipelineStatus?: string | null;
  readonly pipelinePreviewReady?: boolean | null;
}): boolean {
  if (input.integratedAppPreviewReady === true) return true;
  if (input.snapshot.preview.integratedAppPreviewReady) return true;
  if (input.pipelinePreviewReady === true) return true;
  if (String(input.pipelineStatus ?? "").trim() === "integrated_app_preview_ready") return true;

  const runtime = input.previewRuntime ?? null;
  if (isRuntimeIntegratedAppPreviewReadySignal(runtime, input.projectId)) return true;
  if (
    runtime?.status === "ready" &&
    isIntegratedAppRenderTarget({
      projectId: input.projectId,
      runtime,
      integrationPlan: input.integrationPlan ?? null,
    })
  ) {
    return true;
  }

  return false;
}

function resolveIntegratedAppPreviewEntryUrl(input: {
  readonly projectId: string;
  readonly snapshot: ImplementationRuntimeSnapshotV1;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
}): string {
  const pid = input.projectId.trim();
  const runtime = input.previewRuntime ?? null;
  const external = String(runtime?.externalPreviewUrl ?? "").trim();
  if (external) return sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: external })!;
  const githubPages = String(runtime?.githubPagesUrl ?? "").trim();
  if (githubPages) return sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: githubPages })!;
  const internal = String(runtime?.internalAppPreviewUrl ?? "").trim();
  if (internal) return sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: internal })!;
  const appPreview = String(runtime?.appPreviewUrl ?? "").trim();
  if (appPreview.includes("/preview/app")) {
    return sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: appPreview })!;
  }
  const snapshotUrl = String(input.snapshot.preview.previewUrl ?? "").trim();
  if (snapshotUrl && sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: snapshotUrl })) {
    return sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: snapshotUrl })!;
  }
  return null;
}

export function evaluateImplementationPreviewEntryState(input: {
  readonly projectId: string;
  readonly snapshot: ImplementationRuntimeSnapshotV1;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly codeTaskPreviewReady?: boolean;
  readonly integratedAppPreviewReady?: boolean;
  readonly integrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly pipelineStatus?: string | null;
  readonly pipelinePreviewReady?: boolean | null;
}): ImplementationPreviewEntryStateV1 {
  const pid = input.projectId.trim();
  const { failed, inconsistent } = input.snapshot.codeTask;
  if (failed > 0 || inconsistent > 0) {
    return {
      mode: "disabled",
      enabled: false,
      url: null,
      openMode: "none",
      userMessage: "Preview를 준비할 수 없습니다.\n미완료 또는 실패한 CodeTask를 먼저 처리해 주세요.",
      suppressNoticeModal: false,
    };
  }

  const integratedReady = resolveImplementationPreviewIntegratedReady(input);
  const codeTaskReady =
    input.codeTaskPreviewReady === true || input.snapshot.preview.codeTaskPreviewReady;

  if (integratedReady) {
    const url = resolveIntegratedAppPreviewEntryUrl({
      projectId: pid,
      snapshot: input.snapshot,
      previewRuntime: input.previewRuntime,
    });
    if (!url) {
      return {
        mode: "disabled",
        enabled: false,
        url: null,
        openMode: "none",
        userMessage:
          "실제 앱 Preview target을 아직 준비하지 못했습니다.\n통합 및 Preview 준비를 실행하거나 배포 Preview URL을 설정해 주세요.",
        suppressNoticeModal: false,
      };
    }
    return {
      mode: "integrated_app_preview",
      enabled: true,
      url,
      openMode: "new_window",
      userMessage: "Preview 버튼을 눌러 실제 앱 화면을 확인할 수 있습니다.",
      suppressNoticeModal: true,
    };
  }

  if (codeTaskReady) {
    const url = pid ? buildCodeTaskPreviewFallbackUrl(pid) : null;
    return {
      mode: "codetask_result_preview",
      enabled: Boolean(url),
      url,
      openMode: "new_window",
      userMessage:
        "현재는 CodeTask 결과 미리보기입니다.\n실제 앱 Preview는 통합 및 Preview 준비가 완료된 후 열 수 있습니다.",
      suppressNoticeModal: false,
    };
  }

  return {
    mode: "disabled",
    enabled: false,
    url: null,
    openMode: "none",
    userMessage: "Preview를 준비할 수 없습니다.\n미완료 또는 실패한 CodeTask를 먼저 처리해 주세요.",
    suppressNoticeModal: false,
  };
}

export function shouldSuppressImplementationStageNoticeModal(input: {
  readonly entry: ImplementationPreviewEntryStateV1;
  readonly integratedAppPreviewReady?: boolean;
}): boolean {
  if (input.entry.suppressNoticeModal) return true;
  if (input.entry.mode === "integrated_app_preview") return true;
  if (input.integratedAppPreviewReady === true) return true;
  return false;
}
