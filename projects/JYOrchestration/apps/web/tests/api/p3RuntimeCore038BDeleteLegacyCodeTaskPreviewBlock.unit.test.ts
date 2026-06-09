import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ensureCompletedCodeTaskPreviewForFallback } from "@/lib/prototype/completedCodeTaskPreviewBuildService";
import {
  canShowContinuePreviewActionMessage,
  resolveIntegrationPipelineUserToast,
} from "@/lib/prototype/implementationIntegrationToastPolicy";
import { evaluateImplementationPreviewEntryState } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { resolveEffectiveIntegrationSourceBranch } from "@/lib/prototype/integrationEffectiveSourceBranch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const panelPath = join(__dirname, "../../src/components/preview/PrototypePreviewPanel.tsx");
const buildServicePath = join(
  __dirname,
  "../../src/lib/prototype/completedCodeTaskPreviewBuildService.ts",
);
const clientPath = join(__dirname, "../../src/lib/prototype/projectIntegrationPipelineClient.ts");

const COMPLETED_CODETASK_ACTIONS = [
  "completed_codetask_integration_started",
  "completed_codetask_preview_build_started",
  "completed_codetask_integration_completed",
  "completed_codetask_preview_ready",
  "completed_codetask_internal_preview_ready",
  "completed_codetask_external_preview_ready",
  "completed_codetask_preview_fallback",
] as const;

function extractRunIntegrationPipelineBlock(source: string): string {
  const start = source.indexOf("const runIntegrationPipeline = useCallback");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("const createImplementationSeedFromQuickDesignDraft", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("P3-Runtime-Core-03-8B delete legacy codetask preview sync from integration handler", () => {
  it("1–2. integration prepare calls pipeline client only, not batch sync", () => {
    const block = extractRunIntegrationPipelineBlock(readFileSync(panelPath, "utf8"));
    expect(block).toContain("runProjectIntegrationPrepareOnly");
    expect(block).not.toContain("applyIntegratedPipelineSyncSteps");
    expect(block).not.toContain("ensureCompletedCodeTaskPreviewForFallback");
    expect(readFileSync(clientPath, "utf8")).toContain("runIntegrationBranchPipelineClient");
  });

  it("3–6. no completed_codetask timeline actions in runIntegrationPipeline", () => {
    const block = extractRunIntegrationPipelineBlock(readFileSync(panelPath, "utf8"));
    for (const action of COMPLETED_CODETASK_ACTIONS) {
      expect(block).not.toContain(action);
    }
    expect(block).not.toContain("buildCompletedCodeTaskIntegrationTimelineEntry");
  });

  it("7–8. integration handler does not persist CodeTask preview scope/runtime from batch", () => {
    const block = extractRunIntegrationPipelineBlock(readFileSync(panelPath, "utf8"));
    expect(block).not.toContain("batch.previewScope");
    expect(block).not.toContain("batch.previewRuntime");
    expect(block).not.toContain("batch.integratedState");
    expect(block).not.toMatch(
      /runIntegrationPipeline[\s\S]*implementationPreviewScopeV1[\s\S]*batch/,
    );
    expect(block).not.toMatch(
      /runIntegrationPipeline[\s\S]*implementationPreviewRuntimeV1[\s\S]*batch/,
    );
  });

  it("9–10. pipeline integrated ready shows success toast, not continue", () => {
    const toast = resolveIntegrationPipelineUserToast({
      previewReady: true,
      status: "integrated_app_preview_ready",
      integratedAppPreviewReady: true,
      message: "Preview 준비를 계속 진행해야 합니다. 아래 버튼을 눌러 다음 단계를 실행해 주세요.",
      serverSaved: true,
    });
    expect(toast.message).toContain("실제 앱 Preview");
    expect(toast.message).not.toContain("Preview 준비를 계속");
  });

  it("11. integrated preview entry routing", () => {
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
    expect(entry.url).toContain("/preview/app");
  });

  it("12. fallback build rejects integration_prepare_button source", async () => {
    const src = readFileSync(buildServicePath, "utf8");
    expect(src).toContain("applyIntegratedPipelineSyncSteps");
    const blocked = await ensureCompletedCodeTaskPreviewForFallback({
      projectId: "p",
      actionSource: "integration_prepare_button",
      orchestration: {},
    });
    expect(blocked.ok).toBe(false);
    expect(readFileSync(panelPath, "utf8")).toContain("actionSource: \"preview_button\"");
  });

  it("14–15. continue message guards", () => {
    expect(
      canShowContinuePreviewActionMessage({
        previewReady: true,
        nextRequiredStep: "build",
        visibleContinueButton: true,
      }),
    ).toBe(false);
    const toast = resolveIntegrationPipelineUserToast({
      previewReady: true,
      message: "Preview 준비를 계속 진행해야 합니다.",
    });
    expect(toast.message).not.toContain("Preview 준비를 계속");
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
