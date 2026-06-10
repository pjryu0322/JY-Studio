import { describe, expect, it } from "vitest";
import {
  evaluateIntegrationPipelineButtonFromSnapshot,
  resolveIntegrationButtonReadiness,
} from "@/lib/prototype/implementationIntegrationButtonPolicy";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

function baseSnapshot(
  integration: Partial<ImplementationRuntimeSnapshotV1["integration"]>,
): ImplementationRuntimeSnapshotV1 {
  return {
    projectId: "p1",
    codeTask: {
      total: 2,
      selected: 2,
      completed: 2,
      running: 0,
      verifying: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      inconsistent: 0,
      currentUnitId: null,
      currentCodeTaskId: null,
      selectedUnitIds: [],
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
      ...integration,
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
      usedExecutionUnitCount: 2,
      usedRunCount: 2,
      usedIntegrationStepCount: 4,
      ignoredCodeTaskPlanCount: null,
      ignoredBranchPlanIntegrationCount: null,
      warnings: [],
    },
  };
}

describe("implementationIntegrationButtonPolicy", () => {
  it("1-2. enables when tasks complete and autoGenerationReady despite preview permission failure", () => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(
      baseSnapshot({ appPreviewTargetStatus: "pending" }),
      {
        autoGenerationReady: true,
        latestPipelineStatus: "github_preview_permission_required",
      },
    );
    expect(button.enabled).toBe(true);
  });

  it("3-5. enables for app_preview_target_failed and static_preview_artifact_missing pipeline statuses", () => {
    for (const status of ["app_preview_target_failed", "static_preview_artifact_missing"] as const) {
      const readiness = resolveIntegrationButtonReadiness({
        selectedCodeTaskCount: 2,
        selectedCompletedCount: 2,
        selectedFailedCount: 0,
        selectedInconsistentCount: 0,
        autoGenerationReady: true,
        isIntegrationRunning: false,
        latestPipelineStatus: status,
        latestAppPreviewTargetStatus: "pending",
        continueBuildPreview: true,
      });
      expect(readiness.enabled).toBe(true);
    }
  });

  it("6-8. disables when autoGenerationReady false or tasks incomplete or empty", () => {
    expect(
      resolveIntegrationButtonReadiness({
        selectedCodeTaskCount: 2,
        selectedCompletedCount: 2,
        selectedFailedCount: 0,
        selectedInconsistentCount: 0,
        autoGenerationReady: false,
        isIntegrationRunning: false,
        continueBuildPreview: true,
      }).enabled,
    ).toBe(false);
    expect(
      resolveIntegrationButtonReadiness({
        selectedCodeTaskCount: 0,
        selectedCompletedCount: 0,
        selectedFailedCount: 0,
        selectedInconsistentCount: 0,
        autoGenerationReady: true,
        isIntegrationRunning: false,
        continueBuildPreview: true,
      }).enabled,
    ).toBe(false);
    expect(
      resolveIntegrationButtonReadiness({
        selectedCodeTaskCount: 2,
        selectedCompletedCount: 1,
        selectedFailedCount: 0,
        selectedInconsistentCount: 0,
        autoGenerationReady: true,
        isIntegrationRunning: false,
        continueBuildPreview: true,
      }).enabled,
    ).toBe(false);
  });

  it("9. disables when integration is running", () => {
    expect(
      resolveIntegrationButtonReadiness({
        selectedCodeTaskCount: 2,
        selectedCompletedCount: 2,
        selectedFailedCount: 0,
        selectedInconsistentCount: 0,
        autoGenerationReady: true,
        isIntegrationRunning: true,
        continueBuildPreview: true,
      }).enabled,
    ).toBe(false);
  });
});
