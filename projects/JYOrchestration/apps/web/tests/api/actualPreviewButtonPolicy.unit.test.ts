import { describe, expect, it } from "vitest";
import { evaluateActualIntegratedPreviewButtonState } from "@/lib/prototype/actualPreviewButtonPolicy";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import { IMPLEMENTATION_PREVIEW_RUNTIME_VERSION } from "@/lib/prototype/implementationPreviewRuntimeV1";

const PID = "p1";

function minimalSnapshot(previewUrl: string | null): ImplementationRuntimeSnapshotV1 {
  return {
    projectId: PID,
    codeTask: {
      total: 1,
      selected: 1,
      completed: 1,
      running: 0,
      verifying: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      inconsistent: 0,
      currentUnitId: null,
      currentCodeTaskId: null,
      selectedUnitIds: ["u1"],
      pendingCodeTaskIds: [],
      inconsistentCodeTaskIds: [],
    },
    units: [],
    integration: {
      finalWiringStatus: "completed",
      integrationBranchStatus: "completed",
      buildStatus: "completed",
      appPreviewTargetStatus: "completed",
      integratedAppPreviewReady: true,
    },
    preview: {
      integratedAppPreviewReady: true,
      codeTaskPreviewReady: true,
      previewUrl,
      previewReady: true,
    },
    pipeline: { status: null, previewReady: true },
    warnings: [],
  } as ImplementationRuntimeSnapshotV1;
}

describe("actualPreviewButtonPolicy", () => {
  const runtime = {
    version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
    status: "ready" as const,
    runtimeKind: "actual_integrated_app" as const,
    externalPreviewUrl: "https://o.github.io/r/previews/p1/",
    githubPagesUrl: "https://o.github.io/r/previews/p1/",
    sourceScopeVersion: "implementation_preview_scope_v1" as const,
    renderMode: "external_preview" as const,
    openMode: "external_new_window" as const,
    includedCodeTaskIds: ["CT-1"],
    excludedCodeTaskIds: [],
    warnings: [],
  };

  it("5-7. enables when actual URL and ready; disables without URL or preview", () => {
    const enabled = evaluateActualIntegratedPreviewButtonState({
      projectId: PID,
      snapshot: minimalSnapshot("https://o.github.io/r/previews/p1/"),
      previewRuntime: runtime,
      integratedAppPreviewReady: true,
    });
    expect(enabled.enabled).toBe(true);
    expect(enabled.url).toContain("github.io");

    const noUrl = evaluateActualIntegratedPreviewButtonState({
      projectId: PID,
      snapshot: minimalSnapshot(null),
      previewRuntime: { ...runtime, externalPreviewUrl: null, githubPagesUrl: null },
      integratedAppPreviewReady: true,
    });
    expect(noUrl.enabled).toBe(false);
  });

  it("disables during github_pages_deploy_pending", () => {
    const state = evaluateActualIntegratedPreviewButtonState({
      projectId: PID,
      snapshot: minimalSnapshot("https://o.github.io/r/previews/p1/"),
      previewRuntime: runtime,
      integratedAppPreviewReady: true,
      pipelineStatus: "github_pages_deploy_pending",
    });
    expect(state.enabled).toBe(false);
  });
});
