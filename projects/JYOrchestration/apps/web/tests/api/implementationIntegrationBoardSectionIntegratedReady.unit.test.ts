import { describe, expect, it } from "vitest";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import { buildImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { isLegacyCodeTaskPreviewScopeNoticeContent } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { shouldSuppressIntegrationContinueUserMessage } from "@/lib/prototype/implementationPreviewButtonPolicy";

const PID = "p-board-integrated-ready";
const NOW = "2026-06-09T03:00:00.000Z";

const scope = buildImplementationPreviewScopeV1({
  generatedAt: NOW,
  included: [{ codeTaskId: "CT-1", taskId: "DEV-A", title: "Feature", commitSha: "sha" }],
  excluded: [
    {
      codeTaskId: "CT-WIRING",
      taskId: "DEV-INT",
      title: "최종 연결/통합 Wiring",
      status: "대기",
      reason: "미완료",
    },
  ],
  warnings: ["legacy warning"],
});

const integratedRuntime: ImplementationPreviewRuntimeV1 = {
  version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  status: "ready",
  generatedAt: NOW,
  previewUrl: `/projects/${PID}/preview/app/generated`,
  internalAppPreviewUrl: `/projects/${PID}/preview/app/generated`,
  sourceIntegrationBranch: "integration/p-test",
  openMode: "internal_renderer",
  renderMode: "internal_app",
  sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
  includedCodeTaskIds: ["CT-1"],
  excludedCodeTaskIds: ["CT-WIRING"],
  warnings: [],
  errorMessage: null,
};

describe("implementationIntegrationBoardSection integrated ready", () => {
  const eligibility = {
    canIntegrate: true,
    included: [],
    excluded: [],
    warnings: [],
    hasAppShell: true,
    hasAnyScreenTask: true,
  };

  const snapshot = buildImplementationRuntimeSnapshot({
    projectId: PID,
    executionUnits: [],
    selectedExecutionUnitIds: [],
    codeTaskRuns: [],
    integrationSteps: [],
    previewRuntime: integratedRuntime,
  });

  it("9. integrated ready scopeDetailLines omit codetask scope copy", () => {
    const vm = buildImplementationIntegrationBoardSection({
      projectId: PID,
      eligibility,
      integratedPipelineLines: [],
      previewScope: scope,
      previewRuntime: integratedRuntime,
      runtimeSnapshot: {
        ...snapshot,
        preview: { ...snapshot.preview, integratedAppPreviewReady: true },
      },
      integrationPipelinePreviewReady: true,
      integrationPipelineStatus: "integrated_app_preview_ready",
    });
    expect(vm.integratedAppPreviewReady).toBe(true);
    const joined = vm.scopeDetailLines.join("\n");
    expect(joined).not.toContain("완료된 CodeTask");
    expect(joined).not.toContain("제외:");
    expect(joined).toContain("실제 앱 Preview가 준비되었습니다.");
  });

  it("10. integrated ready summaryLines omit scope count", () => {
    const vm = buildImplementationIntegrationBoardSection({
      projectId: PID,
      eligibility,
      integratedPipelineLines: [],
      previewScope: scope,
      previewRuntime: integratedRuntime,
      runtimeSnapshot: {
        ...snapshot,
        preview: { ...snapshot.preview, integratedAppPreviewReady: true },
      },
      integrationPipelinePreviewReady: true,
    });
    expect(vm.summaryLines.some((l) => l.includes("완료된 CodeTask"))).toBe(false);
    expect(vm.previewStatusLines.some((l) => l.includes("실제 앱 Preview: 준비 완료"))).toBe(true);
  });

  it("11. codetask-only state keeps scope detail lines", () => {
    const vm = buildImplementationIntegrationBoardSection({
      projectId: PID,
      eligibility,
      integratedPipelineLines: [],
      previewScope: scope,
      previewRuntime: {
        ...integratedRuntime,
        sourceIntegrationBranch: null,
        openMode: "scope_summary_fallback",
        renderMode: "scope_summary_fallback",
        internalAppPreviewUrl: null,
      },
    });
    expect(vm.integratedAppPreviewReady).toBe(false);
    expect(vm.scopeDetailLines.some((l) => l.includes("이번 Preview는"))).toBe(true);
  });

  it("17. stale continue toast suppressed when pipeline previewReady true", () => {
    expect(
      shouldSuppressIntegrationContinueUserMessage({
        previewReady: true,
        message: "Preview 준비를 계속 진행해야 합니다.",
        integratedAppPreviewReady: false,
      }),
    ).toBe(true);
  });

  it("legacy notice detector matches scope modal copy", () => {
    expect(
      isLegacyCodeTaskPreviewScopeNoticeContent(
        "완료된 CodeTask 15개 기준 통합 · 제외 1개\nPreview 준비 완료",
      ),
    ).toBe(true);
  });
});
