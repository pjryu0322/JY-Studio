import { isIntegratedAppRenderTarget } from "@/lib/prototype/implementationAppPreviewTarget";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { isIntegrationStepCompleted } from "@/lib/prototype/implementationIntegrationStepMutations";
import { resolveIntegrationStepsForRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import type {
  ImplementationPreviewRenderModeV1,
  ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { getCodeTaskDiagnosticPreviewOpenTarget } from "@/lib/prototype/implementationPreviewOpenTarget";

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

const INTEGRATED_RENDER_MODES: ReadonlySet<ImplementationPreviewRenderModeV1> = new Set([
  "internal_generated_app",
  "generated_app",
  "external_preview",
]);

function isCodetaskScopePreviewUrl(url: string | null | undefined): boolean {
  const u = String(url ?? "").trim();
  if (!u) return false;
  if (u.includes("/preview/app")) return false;
  return u.includes("/preview") && u.includes("scope=");
}

export function sanitizeIntegratedAppPreviewUrl(input: {
  readonly projectId: string;
  readonly url: string | null | undefined;
}): string | null {
  const pid = input.projectId.trim();
  const raw = String(input.url ?? "").trim();
  if (!pid) return raw || null;
  if (!raw) return buildIntegratedAppPreviewFallbackUrl(pid);
  if (isCodetaskScopePreviewUrl(raw)) return buildIntegratedAppPreviewFallbackUrl(pid);
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
  if (runtime?.status === "ready") {
    const renderMode = String(runtime.renderMode ?? "");
    if (
      (renderMode && INTEGRATED_RENDER_MODES.has(runtime.renderMode!)) ||
      renderMode === "internal_app"
    ) {
      return true;
    }
    if (String(runtime.internalAppPreviewUrl ?? "").trim()) return true;
    if (String(runtime.externalPreviewUrl ?? "").trim()) return true;
    if (
      isIntegratedAppRenderTarget({
        projectId: input.projectId,
        runtime,
        integrationPlan: input.integrationPlan ?? null,
      })
    ) {
      return true;
    }
  }

  const steps = resolveIntegrationStepsForRuntimeSnapshot({
    requirementsState: input.requirementsState,
    codeTaskPlan: null,
  });
  if (
    steps.length > 0 &&
    runtime?.status === "ready" &&
    isIntegrationStepCompleted(steps, "final_wiring") &&
    isIntegrationStepCompleted(steps, "integration_branch") &&
    isIntegrationStepCompleted(steps, "build") &&
    isIntegrationStepCompleted(steps, "app_preview_target")
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
  const internal = String(runtime?.internalAppPreviewUrl ?? "").trim();
  if (internal) return sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: internal })!;
  const appPreview = String(runtime?.appPreviewUrl ?? "").trim();
  if (appPreview.includes("/preview/app")) {
    return sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: appPreview })!;
  }
  const snapshotUrl = String(input.snapshot.preview.previewUrl ?? "").trim();
  if (snapshotUrl.includes("/preview/app")) {
    return sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: snapshotUrl })!;
  }
  return buildIntegratedAppPreviewFallbackUrl(pid);
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
    return {
      mode: "integrated_app_preview",
      enabled: Boolean(url),
      url,
      openMode: "new_window",
      userMessage: "Preview 버튼을 눌러 실제 앱 화면을 확인할 수 있습니다.",
      suppressNoticeModal: true,
    };
  }

  if (codeTaskReady) {
    const diagnostic = getCodeTaskDiagnosticPreviewOpenTarget({
      runtime: input.previewRuntime,
      codeTaskPreviewReady: true,
    });
    const url =
      diagnostic.url?.trim() || (pid ? buildCodeTaskPreviewFallbackUrl(pid) : null);
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
