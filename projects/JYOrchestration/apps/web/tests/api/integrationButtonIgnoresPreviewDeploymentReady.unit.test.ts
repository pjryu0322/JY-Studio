import { describe, expect, it } from "vitest";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

function minimalReadySnapshot(): ImplementationRuntimeSnapshotV1 {
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
      finalWiringStatus: "ready",
      integrationBranchStatus: "pending",
      buildStatus: "pending",
      appPreviewTargetStatus: "pending",
      canRunIntegration: true,
      canOpenCodeTaskPreview: true,
      canOpenIntegratedAppPreview: false,
      disabledReason: null,
      nextRequiredStep: "final_wiring",
    },
    preview: {
      codeTaskPreviewReady: true,
      integratedAppPreviewReady: false,
      previewUrl: null,
      readinessStatus: "final_wiring_pending",
      message: "",
    },
    diagnostics: {
      source: "implementation_runtime_snapshot",
      usedExecutionUnitCount: 1,
      usedRunCount: 1,
      usedIntegrationStepCount: 1,
      ignoredCodeTaskPlanCount: null,
      ignoredBranchPlanIntegrationCount: null,
      warnings: [],
    },
  };
}

describe("integrationButtonIgnoresPreviewDeploymentReady", () => {
  it("enables integration when autoGenerationReady is true even if preview gate would have blocked", () => {
    const snapshot = minimalReadySnapshot();
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot, {
      autoGenerationReady: true,
    });
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(true);
    expect(button.userStatusLines.join("\n")).not.toContain("Preview 배포 권한");
  });

  it("disables integration when autoGenerationReady is false", () => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(minimalReadySnapshot(), {
      autoGenerationReady: false,
    });
    expect(button.enabled).toBe(false);
    expect(button.userStatusLines.join("\n")).toContain("자동 생성 기본 연결");
  });
});
