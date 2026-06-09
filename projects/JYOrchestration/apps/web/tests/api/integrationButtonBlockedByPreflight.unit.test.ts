import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("integrationButtonBlockedByPreflight", () => {
  it("disables integration button when previewDeploymentReady is false", () => {
    const snapshot = minimalReadySnapshot();
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot, {
      previewDeploymentReady: false,
    });
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(false);
    expect(button.userStatusLines.join("\n")).toContain("Preview 배포 권한 확인이 필요합니다.");
  });

  it("run-pipeline route rejects when preflight blocks preview deployment", () => {
    const routePath = join(
      process.cwd(),
      "src/app/api/prototype/integration/run-pipeline/route.ts",
    );
    const src = readFileSync(routePath, "utf8");
    expect(src).toContain("resolvePreviewDeploymentReadyFromCapabilityJson");
    expect(src).toContain("Preview 배포 권한 확인이 필요합니다.");
  });
});
