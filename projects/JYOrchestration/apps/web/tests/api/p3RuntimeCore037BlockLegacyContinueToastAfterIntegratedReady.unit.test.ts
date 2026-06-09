import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isLegacyContinuePreviewMessage,
  resolveIntegrationPipelineUserToast,
  sanitizeIntegrationPipelineApiResponseMessage,
} from "@/lib/prototype/implementationIntegrationToastPolicy";
import { isLegacyCodeTaskPreviewScopeNoticeContent } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { resolveEffectiveIntegrationSourceBranch } from "@/lib/prototype/integrationEffectiveSourceBranch";
import { evaluateImplementationPreviewEntryState } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(__dirname, "../../src/components/preview");
const routePath = join(__dirname, "../../src/app/api/prototype/integration/run-pipeline/route.ts");

describe("P3-Runtime-Core-03-7 block legacy continue toast", () => {
  it("1. previewReady=true + legacy continue message becomes success toast", () => {
    const toast = resolveIntegrationPipelineUserToast({
      previewReady: true,
      message: "Preview 준비를 계속 진행해야 합니다. 아래 버튼을 눌러 다음 단계를 실행해 주세요.",
    });
    expect(toast.reason).toBe("suppressed_legacy_continue");
    expect(toast.message).toContain("실제 앱 Preview가 준비되었습니다");
    expect(toast.message).not.toContain("Preview 준비를 계속");
  });

  it("2. integrated_app_preview_ready status sanitizes legacy message", () => {
    const toast = resolveIntegrationPipelineUserToast({
      status: "integrated_app_preview_ready",
      previewReady: false,
      message: "Preview 준비를 계속 진행해야 합니다.",
    });
    expect(toast.reason).toBe("suppressed_legacy_continue");
    expect(toast.message).toContain("Preview 버튼");
  });

  it("3. not integrated allows continue toast when continue button visible", () => {
    const toast = resolveIntegrationPipelineUserToast({
      previewReady: false,
      message: "Preview 준비를 계속 진행해야 합니다. 아래 버튼을 눌러 다음 단계를 실행해 주세요.",
      nextRequiredStep: "build",
      hasVisibleContinueButton: true,
    });
    expect(toast.reason).toBe("continue_next_step");
    expect(toast.message).toContain("Preview 준비를 계속");
  });

  it("4. serverSaved=false prioritizes save failure message", () => {
    const toast = resolveIntegrationPipelineUserToast({
      previewReady: true,
      serverSaved: false,
      message: "Preview 준비를 계속 진행해야 합니다.",
    });
    expect(toast.reason).toBe("server_save_failed");
    expect(toast.message).toContain("서버 저장에 실패");
  });

  it("5. PrototypePreviewPanel uses resolveIntegrationPipelineUserToast", () => {
    const src = readFileSync(join(componentsDir, "PrototypePreviewPanel.tsx"), "utf8");
    expect(src).toContain("resolveIntegrationPipelineUserToast");
    expect(src).not.toMatch(/suppressContinueToast\)\s*\{\s*showToast\(\s*integrationServerSaved\s*\?\s*pipelineResult\.message/);
  });

  it("6. isLegacyContinuePreviewMessage detects continue copy", () => {
    expect(isLegacyContinuePreviewMessage("Preview 준비를 계속 진행해야 합니다.")).toBe(true);
    expect(isLegacyContinuePreviewMessage("실제 앱 Preview가 준비되었습니다.")).toBe(false);
  });

  it("7. integrated status yields success toast message", () => {
    const toast = resolveIntegrationPipelineUserToast({
      status: "integrated_app_preview_ready",
      previewReady: true,
    });
    expect(toast.show).toBe(true);
    expect(toast.message).toContain("실제 앱 Preview");
  });

  it("8. legacy scope notice detector", () => {
    expect(isLegacyCodeTaskPreviewScopeNoticeContent("완료된 CodeTask 15개 기준 통합 · 제외 1개")).toBe(
      true,
    );
  });

  it("11. API sanitize returns success for integrated ready", () => {
    const msg = sanitizeIntegrationPipelineApiResponseMessage({
      status: "integrated_app_preview_ready",
      previewReady: true,
      userSafeMessage: "Preview 준비를 계속 진행해야 합니다.",
      ok: true,
    });
    expect(msg).toContain("실제 앱 Preview가 준비되었습니다");
    expect(msg).not.toContain("Preview 준비를 계속");
  });

  it("12. previewReady=true API sanitize blocks continue", () => {
    const msg = sanitizeIntegrationPipelineApiResponseMessage({
      previewReady: true,
      userSafeMessage: "Preview 준비를 계속 진행해야 합니다.",
      ok: true,
    });
    expect(msg).not.toContain("Preview 준비를 계속");
  });

  it("13. integrated preview routing preserved", () => {
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

  it("14. source branch resolver regression", () => {
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

  it("route uses sanitize helper", () => {
    const src = readFileSync(routePath, "utf8");
    expect(src).toContain("sanitizeIntegrationPipelineApiResponseMessage");
  });
});
