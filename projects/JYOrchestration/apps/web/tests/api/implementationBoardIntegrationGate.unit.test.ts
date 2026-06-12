import { describe, expect, it } from "vitest";
import {
  evaluateIntegrationBlockedByRunnableBoardSummary,
  evaluatePrepareIntegrationPreviewStartGate,
  INTEGRATION_NO_COMPLETED_TARGETS_USER_MESSAGE,
} from "@/lib/prototype/implementationBoardIntegrationGate";

describe("evaluateIntegrationBlockedByRunnableBoardSummary", () => {
  it("no longer blocks integration when runnable rows remain", () => {
    const gate = evaluateIntegrationBlockedByRunnableBoardSummary({ runnableCount: 1 });
    expect(gate.ok).toBe(true);
    expect(gate.message).toBeNull();
  });
});

describe("evaluatePrepareIntegrationPreviewStartGate", () => {
  it("blocks when no integration-ready completed tasks", () => {
    const gate = evaluatePrepareIntegrationPreviewStartGate({
      integrationReadyCount: 0,
      integrationReadyCodeTaskIds: [],
    });
    expect(gate.ok).toBe(false);
    expect(gate.message).toBe(INTEGRATION_NO_COMPLETED_TARGETS_USER_MESSAGE);
  });

  it("allows only integration-ready code task ids", () => {
    const gate = evaluatePrepareIntegrationPreviewStartGate({
      integrationReadyCount: 2,
      integrationReadyCodeTaskIds: ["A", "B"],
    });
    expect(gate.ok).toBe(true);
    expect(gate.codeTaskIds).toEqual(["A", "B"]);
  });
});
