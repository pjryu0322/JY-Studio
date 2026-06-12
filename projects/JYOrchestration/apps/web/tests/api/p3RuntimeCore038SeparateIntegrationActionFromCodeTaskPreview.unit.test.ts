import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  canShowContinuePreviewActionMessage,
  INTEGRATION_PIPELINE_CONTINUE_STATUS_MESSAGE,
  resolveIntegrationPipelineUserToast,
} from "@/lib/prototype/implementationIntegrationToastPolicy";
import {
  isCompletedCodeTaskPreviewTimelineAction,
  shouldSuppressCompletedCodeTaskPreviewUserNotice,
} from "@/lib/prototype/implementationPreviewActionSource";
import {
  shouldRunCompletedCodeTaskPreviewFallbackOnOpen,
} from "@/lib/prototype/completedCodeTaskPreviewFallback";
import { evaluateImplementationPreviewEntryState } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { resolveEffectiveIntegrationSourceBranch } from "@/lib/prototype/integrationEffectiveSourceBranch";
import { readImplementationStagePanelSources } from "../helpers/implementationStagePanelSources";

const __dirname = dirname(fileURLToPath(import.meta.url));
const boardPath = join(
  __dirname,
  "../../src/components/preview/ImplementationExecutionBoardPanel.tsx",
);

const clientPath = join(__dirname, "../../src/lib/prototype/projectIntegrationPipelineClient.ts");

function extractRunIntegrationPipelineBlock(source: string): string {
  const start = source.indexOf("const runIntegrationPipeline = useCallback");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("const createImplementationSeedFromQuickDesignDraft", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("P3-Runtime-Core-03-8 separate integration from codetask preview", () => {
  it("1–2. runIntegrationPipeline does not run completed_codetask preview build", () => {
    const block = extractRunIntegrationPipelineBlock(readImplementationStagePanelSources());
    expect(block).toContain("executeImplementationBoardIntegrationPipeline");
    expect(block).not.toContain("runIntegrationBranchPipelineClient");
    expect(block).not.toContain("applyIntegratedPipelineSyncSteps");
    expect(block).not.toContain("completed_codetask_preview_build_started");
    expect(block).not.toContain("completed_codetask_preview_ready");
    expect(block).not.toContain("buildCompletedCodeTaskIntegrationTimelineEntry");
  });

  it("2b. runProjectIntegrationPrepareOnly wraps pipeline client only", () => {
    const src = readFileSync(clientPath, "utf8");
    expect(src).toContain("runIntegrationBranchPipelineClient");
    expect(src).not.toContain("applyIntegratedPipelineSyncSteps");
  });

  it("8. Preview fallback only on codetask open without scope", () => {
    expect(
      shouldRunCompletedCodeTaskPreviewFallbackOnOpen({
        mode: "codetask_result_preview",
        integratedAppPreviewReady: false,
        previewScopeV1: null,
        previewRuntimeV1: null,
      }),
    ).toBe(true);
    expect(
      shouldRunCompletedCodeTaskPreviewFallbackOnOpen({
        mode: "codetask_result_preview",
        integratedAppPreviewReady: true,
        previewScopeV1: null,
        previewRuntimeV1: null,
      }),
    ).toBe(false);
    const panelSrc = readImplementationStagePanelSources();
    expect(panelSrc).toContain("openImplementationPreview");
    expect(panelSrc).toContain("ensureCompletedCodeTaskPreviewForFallback");
  });

  it("4. previewReady=true yields success toast only", () => {
    const toast = resolveIntegrationPipelineUserToast({
      previewReady: true,
      message: "Preview 준비를 계속 진행해야 합니다. 아래 버튼을 눌러 다음 단계를 실행해 주세요.",
    });
    expect(toast.message).toContain("실제 앱 Preview가 준비되었습니다");
    expect(toast.message).not.toContain("Preview 준비를 계속");
  });

  it("8–9. integrated ready never shows continue toast", () => {
    const toast = resolveIntegrationPipelineUserToast({
      status: "integrated_app_preview_ready",
      previewReady: true,
      message: "Preview 준비를 계속 진행해야 합니다.",
    });
    expect(toast.message).not.toContain("Preview 준비를 계속");
  });

  it("10–11. continue copy requires visible continue button", () => {
    expect(
      canShowContinuePreviewActionMessage({
        previewReady: false,
        nextRequiredStep: "build",
        hasVisibleContinueButton: false,
      }),
    ).toBe(false);

    const toast = resolveIntegrationPipelineUserToast({
      previewReady: false,
      message: "Preview 준비를 계속 진행해야 합니다. 아래 버튼을 눌러 다음 단계를 실행해 주세요.",
      nextRequiredStep: "build",
      hasVisibleContinueButton: false,
    });
    expect(toast.reason).toBe("fallback_message");
    expect(toast.message).toBe(INTEGRATION_PIPELINE_CONTINUE_STATUS_MESSAGE);
    expect(toast.message).not.toContain("아래 버튼");
  });

  it("12. integration_prepare_button ignores completed_codetask preview notices", () => {
    expect(
      shouldSuppressCompletedCodeTaskPreviewUserNotice({
        actionSource: "integration_prepare_button",
        integratedReady: false,
        action: "completed_codetask_preview_ready",
      }),
    ).toBe(true);
    expect(isCompletedCodeTaskPreviewTimelineAction("completed_codetask_preview_ready")).toBe(true);
  });

  it("5–6. preview button opens integrated app URL when ready", () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      generatedAt: "2026-06-09T04:00:00.000Z",
      externalPreviewUrl: "https://o.github.io/r/previews/p/",
      githubPagesUrl: "https://o.github.io/r/previews/p/",
      runtimeKind: "actual_integrated_app",
      sourceIntegrationBranch: "integration/p-test",
      openMode: "external_new_window",
      renderMode: "external_preview",
      sourceScopeVersion: "implementation_preview_scope_v1",
      includedCodeTaskIds: [],
      excludedCodeTaskIds: [],
      warnings: [],
      errorMessage: null,
    };
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: "p",
      executionUnits: [],
      selectedExecutionUnitIds: [],
      codeTaskRuns: [],
      integrationSteps: [],
      previewRuntime: runtime,
    });
    const entry = evaluateImplementationPreviewEntryState({
      projectId: "p",
      snapshot: { ...snapshot, preview: { ...snapshot.preview, integratedAppPreviewReady: true } },
      previewRuntime: runtime,
      integratedAppPreviewReady: true,
    });
    expect(entry.mode).toBe("integrated_app_preview");
    expect(entry.url).toContain("github.io");

    const boardSrc = readImplementationStagePanelSources();
    expect(boardSrc).toContain("openActualIntegratedPreviewInNewWindow");
    expect(boardSrc).toContain("onOpenImplementationPreview");
  });

  it("15–17. regression: branch resolver and integrated routing preserved", () => {
    expect(
      resolveEffectiveIntegrationSourceBranch({
        contextSourceBranch: "wip/screen/workspace",
        contextTargetBranch: "main",
        contextIntegrationBranch: "integration/p",
        topologyChainHead: null,
        includedWorkBranches: ["wip/screen/workspace"],
      }).sourceBranch,
    ).toBe("wip/screen/workspace");
  });
});
