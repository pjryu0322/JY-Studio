import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import {
  evaluateImplementationPreviewEntryState,
  type ImplementationPreviewEntryModeV1,
} from "@/lib/prototype/implementationPreviewEntryPolicy";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ImplementationPreviewButtonModeV1 = ImplementationPreviewEntryModeV1;

export type ImplementationPreviewButtonStateV1 = Readonly<{
  readonly show: boolean;
  readonly enabled: boolean;
  readonly label: "Preview";
  readonly mode: ImplementationPreviewButtonModeV1;
  readonly url: string | null;
  readonly userMessage: string;
  readonly disabledReason: string | null;
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
  const entry = evaluateImplementationPreviewEntryState(input);
  const { failed, inconsistent, selected } = input.snapshot.codeTask;
  return {
    show: entry.mode !== "disabled" || selected > 0,
    enabled: entry.enabled,
    label: "Preview",
    mode: entry.mode,
    url: entry.url,
    userMessage: entry.userMessage,
    disabledReason: entry.enabled
      ? null
      : failed > 0 || inconsistent > 0
        ? "실패 또는 검증 불일치 CodeTask가 있습니다."
        : entry.mode === "disabled" && selected > 0
          ? "완료된 CodeTask가 없습니다."
          : entry.mode === "disabled"
            ? "선택된 CodeTask가 없습니다."
            : "Preview URL이 아직 없습니다.",
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
