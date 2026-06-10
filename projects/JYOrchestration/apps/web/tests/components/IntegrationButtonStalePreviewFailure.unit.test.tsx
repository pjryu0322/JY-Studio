import { describe, expect, it } from "vitest";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

function snapshotAtPreviewFailure(): ImplementationRuntimeSnapshotV1 {
  return {
    projectId: "p1",
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
      steps: [],
      finalWiringStatus: "completed",
      integrationBranchStatus: "completed",
      buildStatus: "completed",
      appPreviewTargetStatus: "pending",
      canRunIntegration: true,
      canOpenCodeTaskPreview: true,
      canOpenIntegratedAppPreview: false,
      disabledReason: null,
      nextRequiredStep: "app_preview_target",
    },
    preview: {
      codeTaskPreviewReady: true,
      integratedAppPreviewReady: false,
      previewUrl: null,
      readinessStatus: "app_preview_target_pending",
      message: "",
    },
    diagnostics: {
      source: "implementation_runtime_snapshot",
      usedExecutionUnitCount: 1,
      usedRunCount: 1,
      usedIntegrationStepCount: 4,
      ignoredCodeTaskPlanCount: null,
      ignoredBranchPlanIntegrationCount: null,
      warnings: [],
    },
  };
}

describe("IntegrationButtonStalePreviewFailure", () => {
  it("10-12. enables integration button for preview failure pipeline statuses", () => {
    for (const status of [
      "github_preview_permission_required",
      "app_preview_target_failed",
      "static_preview_artifact_missing",
    ]) {
      const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshotAtPreviewFailure(), {
        autoGenerationReady: true,
        latestPipelineStatus: status,
      });
      expect(button.enabled).toBe(true);
    }
  });

  it("14. does not show auto generation message when preview failed but envcheck ready", () => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshotAtPreviewFailure(), {
      autoGenerationReady: true,
      latestPipelineStatus: "github_preview_permission_required",
    });
    expect(button.userStatusLines.join("\n")).not.toContain("자동 생성 기본 연결을 먼저 정상화");
  });

  it("15. shows auto generation message only when autoGenerationReady is false", () => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshotAtPreviewFailure(), {
      autoGenerationReady: false,
      latestPipelineStatus: "github_preview_permission_required",
    });
    expect(button.enabled).toBe(false);
    expect(button.userStatusLines.join("\n")).toContain("자동 생성 기본 연결을 먼저 정상화");
  });
});
