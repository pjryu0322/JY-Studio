import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ensureCompletedCodeTaskPreviewForFallback } from "@/lib/prototype/completedCodeTaskPreviewBuildService";
import {
  canShowContinuePreviewActionMessage,
  INTEGRATION_PIPELINE_CONTINUE_STATUS_MESSAGE,
  resolveIntegrationPipelineUserToast,
} from "@/lib/prototype/implementationIntegrationToastPolicy";
import {
  COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION,
  shouldSuppressCompletedCodeTaskPreviewUserNotice,
  type ImplementationPreviewActionSourceV1,
} from "@/lib/prototype/implementationPreviewActionSource";
import { shouldRunCompletedCodeTaskPreviewFallbackOnOpen } from "@/lib/prototype/completedCodeTaskPreviewFallback";
import { evaluateImplementationPreviewEntryState } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { resolveEffectiveIntegrationSourceBranch } from "@/lib/prototype/integrationEffectiveSourceBranch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const panelPath = join(__dirname, "../../src/components/preview/PrototypePreviewPanel.tsx");
const boardPath = join(
  __dirname,
  "../../src/components/preview/ImplementationExecutionBoardPanel.tsx",
);
const clientPath = join(__dirname, "../../src/lib/prototype/projectIntegrationPipelineClient.ts");
const buildServicePath = join(
  __dirname,
  "../../src/lib/prototype/completedCodeTaskPreviewBuildService.ts",
);

function extractRunIntegrationPipelineBlock(source: string): string {
  const start = source.indexOf("const runIntegrationPipeline = useCallback");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("const createImplementationSeedFromQuickDesignDraft", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("P3-Runtime-Core-03-8A isolate integration prepare from codetask preview", () => {
  it("1–4. runIntegrationPipeline does not emit completed_codetask preview timeline actions", () => {
    const block = extractRunIntegrationPipelineBlock(readFileSync(panelPath, "utf8"));
    expect(block).toContain("runProjectIntegrationPrepareOnly");
    expect(block).not.toContain("applyIntegratedPipelineSyncSteps");
    expect(block).not.toContain("completed_codetask_integration_started");
    expect(block).not.toContain("completed_codetask_preview_build_started");
    expect(block).not.toContain("completed_codetask_preview_ready");
    expect(block).not.toContain("completed_codetask_internal_preview_ready");
    expect(block).not.toContain("buildCompletedCodeTaskIntegrationTimelineEntry");
  });

  it("6–7. prepare-only client wraps runIntegrationBranchPipelineClient without batch sync", () => {
    const src = readFileSync(clientPath, "utf8");
    expect(src).toContain("runIntegrationBranchPipelineClient");
    expect(src).not.toContain("applyIntegratedPipelineSyncSteps");
  });

  it("8–9. previewReady integrated success toast without continue copy", () => {
    const toast = resolveIntegrationPipelineUserToast({
      previewReady: true,
      status: "integrated_app_preview_ready",
      message: "Preview 준비를 계속 진행해야 합니다. 아래 버튼을 눌러 다음 단계를 실행해 주세요.",
    });
    expect(toast.message).toContain("실제 앱 Preview");
    expect(toast.message).not.toContain("Preview 준비를 계속");
  });

  it("11–12. fallback build only via ensureCompletedCodeTaskPreviewForFallback", async () => {
    const src = readFileSync(buildServicePath, "utf8");
    expect(src).toContain("ensureCompletedCodeTaskPreviewForFallback");
    expect(src).toContain("applyIntegratedPipelineSyncSteps");

    const blocked = await ensureCompletedCodeTaskPreviewForFallback({
      projectId: "p",
      actionSource: "integration_prepare_button",
      orchestration: {},
    });
    expect(blocked.ok).toBe(false);

    const panelSrc = readFileSync(panelPath, "utf8");
    expect(panelSrc).toContain("ensureCompletedCodeTaskPreviewForFallback");
    expect(panelSrc).not.toMatch(/runIntegrationPipeline[\s\S]*applyIntegratedPipelineSyncSteps/);
  });

  it("13–15. continue message requires next step and visible button", () => {
    expect(
      canShowContinuePreviewActionMessage({
        previewReady: false,
        nextRequiredStep: null,
        visibleContinueButton: true,
      }),
    ).toBe(false);

    const toast = resolveIntegrationPipelineUserToast({
      previewReady: false,
      message: "Preview 준비를 계속 진행해야 합니다. 아래 버튼을 눌러 다음 단계를 실행해 주세요.",
      nextRequiredStep: "build",
      visibleContinueButton: false,
    });
    expect(toast.message).toBe(INTEGRATION_PIPELINE_CONTINUE_STATUS_MESSAGE);
    expect(toast.message).not.toContain("아래 버튼");
  });

  it("10. preview button integrated routing", () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      generatedAt: "2026-06-09T04:00:00.000Z",
      internalAppPreviewUrl: "/projects/p/preview/app/generated",
      sourceIntegrationBranch: "integration/p-test",
      openMode: "internal_renderer",
      renderMode: "internal_app",
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
    expect(readFileSync(boardPath, "utf8")).toContain("onOpenImplementationPreview");
  });

  it("legacy notice suppression guard and log id", () => {
    const sources: ImplementationPreviewActionSourceV1[] = [
      "integration_prepare_button",
      "preview_button",
      "diagnostic",
    ];
    expect(sources).toContain("diagnostic");
    expect(
      shouldSuppressCompletedCodeTaskPreviewUserNotice({
        actionSource: "integration_prepare_button",
        integratedReady: false,
        action: "completed_codetask_preview_ready",
      }),
    ).toBe(true);
    expect(COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION).toBe(
      "completed_codetask_preview_notice_suppressed_for_integration_action",
    );
    expect(
      shouldRunCompletedCodeTaskPreviewFallbackOnOpen({
        mode: "codetask_result_preview",
        integratedAppPreviewReady: false,
        previewScopeV1: null,
        previewRuntimeV1: null,
      }),
    ).toBe(true);
  });

  it("16–18. regression", () => {
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
