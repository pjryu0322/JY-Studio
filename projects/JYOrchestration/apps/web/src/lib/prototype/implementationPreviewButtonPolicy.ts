import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import {
  evaluateActualIntegratedPreviewButtonState,
  ACTUAL_PREVIEW_BUTTON_LABEL,
} from "@/lib/prototype/actualPreviewButtonPolicy";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ImplementationPreviewButtonModeV1 =
  | "integrated_app_preview"
  | "disabled";

export type ImplementationPreviewButtonStateV1 = Readonly<{
  readonly show: boolean;
  readonly enabled: boolean;
  readonly label: typeof ACTUAL_PREVIEW_BUTTON_LABEL;
  readonly mode: ImplementationPreviewButtonModeV1;
  readonly url: string | null;
  readonly userMessage: string;
  readonly disabledReason: string | null;
  readonly title: string;
}>;

export { buildCodeTaskPreviewFallbackUrl, buildIntegratedAppPreviewFallbackUrl } from "@/lib/prototype/implementationPreviewEntryPolicy";

export function evaluateImplementationPreviewButtonState(input: {
  readonly projectId: string;
  readonly snapshot: ImplementationRuntimeSnapshotV1;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly codeTaskPreviewReady?: boolean;
  readonly integratedAppPreviewReady?: boolean;
  readonly integrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly pipelineStatus?: string | null;
  readonly pipelinePreviewReady?: boolean | null;
}): ImplementationPreviewButtonStateV1 {
  void input.codeTaskPreviewReady;
  const actual = evaluateActualIntegratedPreviewButtonState({
    projectId: input.projectId,
    snapshot: input.snapshot,
    previewRuntime: input.previewRuntime,
    integratedAppPreviewReady: input.integratedAppPreviewReady,
    integrationPlan: input.integrationPlan,
    requirementsState: input.requirementsState,
    pipelineStatus: input.pipelineStatus,
    pipelinePreviewReady: input.pipelinePreviewReady,
  });
  return {
    show: actual.show,
    enabled: actual.enabled,
    label: actual.label,
    mode: actual.enabled ? "integrated_app_preview" : "disabled",
    url: actual.url,
    userMessage: actual.enabled
      ? "Preview 보기를 눌러 실제 앱 화면을 새 창에서 확인할 수 있습니다."
      : actual.disabledReason ?? actual.title,
    disabledReason: actual.disabledReason,
    title: actual.title,
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
  const message = String(input.message ?? "").trim();
  if (message.includes("Preview 준비를 계속 진행해야 합니다") && input.integratedAppPreviewReady === true) {
    return true;
  }
  return false;
}
