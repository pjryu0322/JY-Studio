import { describe, expect, it } from "vitest";
import { evaluateImplementationPreviewEntryState } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";

describe("preview entry requires GitHub Pages URL", () => {
  it("16. githubPagesUrl alone enables integrated preview entry", () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      renderMode: "external_preview",
      openMode: "external_new_window",
      externalPreviewUrl: "https://owner.github.io/repo/previews/p/",
      githubPagesUrl: "https://owner.github.io/repo/previews/p/",
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
    expect(entry.url).toBe("https://owner.github.io/repo/previews/p/");
  });
});
