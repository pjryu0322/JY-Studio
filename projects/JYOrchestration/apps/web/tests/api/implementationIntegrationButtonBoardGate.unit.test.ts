import { describe, expect, it } from "vitest";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

function snapshotNoCheckboxSelection(): ImplementationRuntimeSnapshotV1 {
  return {
    projectId: "p1",
    codeTask: {
      total: 15,
      selected: 0,
      completed: 0,
      failed: 0,
      inconsistent: 0,
      pendingCodeTaskIds: [],
      inconsistentCodeTaskIds: [],
    },
    integration: {
      finalWiringStatus: "ready",
      integrationBranchStatus: "pending",
      buildStatus: "pending",
      appPreviewTargetStatus: "pending",
      nextRequiredStep: "final_wiring",
      disabledReason: null,
    },
    preview: {
      integratedAppPreviewReady: false,
      codeTaskPreviewReady: false,
      readinessStatus: "codetask_completion_pending",
      message: "",
      previewUrl: null,
    },
    units: [],
  } as ImplementationRuntimeSnapshotV1;
}

describe("evaluateIntegrationPipelineButtonFromSnapshot board gate", () => {
  it("enables integration when integration-ready count > 0 and no checkbox selection", () => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshotNoCheckboxSelection(), {
      autoGenerationReady: true,
      boardGateSummary: {
        totalCount: 15,
        runnableCount: 0,
        integrationReadyCount: 15,
        integrationReadyCodeTaskIds: ["CT-1"],
        selectedRunnableCount: 0,
        selectedRunnableCodeTaskIds: [],
      },
    });
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(true);
  });
});
