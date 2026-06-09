import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildIntegratedAppPreviewFallbackUrl,
  evaluateImplementationPreviewEntryState,
  sanitizeIntegratedAppPreviewUrl,
} from "@/lib/prototype/implementationPreviewEntryPolicy";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPreviewClientPath = join(
  __dirname,
  "../../src/components/preview/GeneratedAppPreviewPageClient.tsx",
);

describe("preview entry requires actual app url", () => {
  it("8. sanitize rejects synthetic /preview/app?scope=latest fallback", () => {
    expect(
      sanitizeIntegratedAppPreviewUrl({
        projectId: "p",
        url: buildIntegratedAppPreviewFallbackUrl("p"),
      }),
    ).toBeNull();
  });

  it("15. integrated entry disabled without actual URL", () => {
    const diagnosticRuntime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      generatedAt: "2026-01-01T00:00:00.000Z",
      internalAppPreviewUrl: buildIntegratedAppPreviewFallbackUrl("p"),
      sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      renderMode: "internal_generated_app",
      openMode: "internal_renderer",
      includedCodeTaskIds: ["C1"],
      excludedCodeTaskIds: [],
      warnings: [],
      runtimeKind: "codetask_diagnostic_preview",
    };
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: "p",
      executionUnits: [],
      selectedExecutionUnitIds: [],
      codeTaskRuns: [],
      integrationSteps: [],
      previewRuntime: diagnosticRuntime,
    });
    const entry = evaluateImplementationPreviewEntryState({
      projectId: "p",
      snapshot: {
        ...snapshot,
        preview: { ...snapshot.preview, integratedAppPreviewReady: false, codeTaskPreviewReady: true },
      },
      previewRuntime: diagnosticRuntime,
      codeTaskPreviewReady: true,
      integratedAppPreviewReady: false,
      pipelinePreviewReady: false,
    });
    expect(entry.mode).not.toBe("integrated_app_preview");
  });

  it("14. actual external URL enables integrated preview entry", () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      renderMode: "external_preview",
      openMode: "external_new_window",
      externalPreviewUrl: "https://pages.example/project",
      includedCodeTaskIds: [],
      excludedCodeTaskIds: [],
      warnings: [],
      runtimeKind: "actual_integrated_app",
      sourceIntegrationBranch: "integration/p",
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
      snapshot: {
        ...snapshot,
        preview: { ...snapshot.preview, integratedAppPreviewReady: true },
      },
      previewRuntime: runtime,
      integratedAppPreviewReady: true,
      pipelinePreviewReady: true,
      pipelineStatus: "integrated_app_preview_ready",
    });
    expect(entry.mode).toBe("integrated_app_preview");
    expect(entry.url).toBe("https://pages.example/project");
  });

  it("9–11. /preview/app client does not default to diagnostic renderer", () => {
    const src = readFileSync(appPreviewClientPath, "utf8");
    expect(src).toContain("actual-app-preview-not-ready");
    expect(src).not.toContain("GeneratedAppPreviewRenderer");
  });
});
