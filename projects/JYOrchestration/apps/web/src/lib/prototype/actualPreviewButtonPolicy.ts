import {
  resolveImplementationPreviewIntegratedReady,
  sanitizeIntegratedAppPreviewUrl,
} from "@/lib/prototype/implementationPreviewEntryPolicy";
import { isActualIntegratedAppPreviewRuntime } from "@/lib/prototype/implementationPreviewRuntimeKind";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { resolveActualIntegratedPreviewUrlForOpen } from "@/lib/prototype/implementationPreviewUrlResolver";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export const ACTUAL_PREVIEW_BUTTON_LABEL = "Preview 보기" as const;

export const ACTUAL_PREVIEW_BUTTON_ENABLED_TITLE =
  "통합된 실제 앱 Preview를 새 창에서 엽니다." as const;

export const ACTUAL_PREVIEW_BUTTON_DISABLED_TITLE =
  "Preview URL이 아직 준비되지 않았습니다. 먼저 통합 및 Preview 준비를 완료해 주세요." as const;

const PREVIEW_VIEW_BLOCKING_PIPELINE_STATUSES = new Set<string>([
  "github_pages_deploy_pending",
  "sample_data_required",
]);

export type ActualIntegratedPreviewButtonStateV1 = Readonly<{
  readonly show: boolean;
  readonly enabled: boolean;
  readonly label: typeof ACTUAL_PREVIEW_BUTTON_LABEL;
  readonly url: string | null;
  readonly title: string;
  readonly disabledReason: string | null;
  readonly runtimeKind: "actual_integrated_app" | "other" | null;
}>;

export function evaluateActualIntegratedPreviewButtonState(input: {
  readonly projectId: string;
  readonly snapshot: ImplementationRuntimeSnapshotV1;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly integratedAppPreviewReady?: boolean;
  readonly integrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly pipelineStatus?: string | null;
  readonly pipelinePreviewReady?: boolean | null;
  readonly showInIntegrationSection?: boolean;
}): ActualIntegratedPreviewButtonStateV1 {
  const pid = input.projectId.trim();
  const { failed, inconsistent, selected } = input.snapshot.codeTask;
  const show = input.showInIntegrationSection !== false && selected > 0;

  if (failed > 0 || inconsistent > 0) {
    return {
      show,
      enabled: false,
      label: ACTUAL_PREVIEW_BUTTON_LABEL,
      url: null,
      title: ACTUAL_PREVIEW_BUTTON_DISABLED_TITLE,
      disabledReason: "실패 또는 검증 불일치 CodeTask가 있습니다.",
      runtimeKind: null,
    };
  }

  const integratedReady = resolveImplementationPreviewIntegratedReady(input);
  const runtime = input.previewRuntime ?? null;
  const url = resolveActualIntegratedPreviewUrlForOpen({
    projectId: pid,
    previewRuntime: runtime,
    snapshotPreviewUrl: input.snapshot.preview.previewUrl,
  });

  const isActualRuntime =
    runtime &&
    isActualIntegratedAppPreviewRuntime({
      projectId: pid,
      runtime,
    });

  const runtimeReady = runtime?.status === "ready";
  const pipelineBlocks = PREVIEW_VIEW_BLOCKING_PIPELINE_STATUSES.has(
    String(input.pipelineStatus ?? "").trim(),
  );

  const enabled =
    integratedReady &&
    Boolean(url) &&
    isActualRuntime === true &&
    runtimeReady === true &&
    !pipelineBlocks;

  const sanitizedUrl =
    url && pid ? sanitizeIntegratedAppPreviewUrl({ projectId: pid, url }) : null;

  return {
    show,
    enabled,
    label: ACTUAL_PREVIEW_BUTTON_LABEL,
    url: sanitizedUrl,
    title: enabled ? ACTUAL_PREVIEW_BUTTON_ENABLED_TITLE : ACTUAL_PREVIEW_BUTTON_DISABLED_TITLE,
    disabledReason: enabled ? null : ACTUAL_PREVIEW_BUTTON_DISABLED_TITLE,
    runtimeKind: isActualRuntime ? "actual_integrated_app" : null,
  };
}
