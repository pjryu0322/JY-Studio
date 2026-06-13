import { describe, expect, it } from "vitest";
import {
  evaluateIntegrationButtonGate,
  INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE,
} from "@/lib/prototype/implementationIntegrationButtonGate";
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";

function summary(
  overrides: Partial<ImplementationCodeTaskSelectionSummaryV1> = {},
): ImplementationCodeTaskSelectionSummaryV1 {
  return {
    totalCount: 15,
    runnableCount: 0,
    integrationReadyCount: 15,
    selectedRunnableCount: 0,
    selectedRunnableCodeTaskIds: [],
    integrationReadyCodeTaskIds: Array.from({ length: 15 }, (_, i) => `CODE-${i + 1}`),
    ...overrides,
  };
}

describe("evaluateIntegrationButtonGate", () => {
  it("allows integration when runnableCount is zero and integrationReadyCount is positive", () => {
    const gate = evaluateIntegrationButtonGate({
      summary: summary(),
      finalWiringReady: true,
      selectedCount: 0,
    });
    expect(gate.canRun).toBe(true);
    expect(gate.blockReason).toBeNull();
  });

  it("does not block integration only because selectedCount is zero", () => {
    const gate = evaluateIntegrationButtonGate({
      summary: summary({ selectedRunnableCount: 0 }),
      finalWiringReady: true,
      selectedCount: 0,
    });
    expect(gate.canRun).toBe(true);
  });

  it("blocks integration when runnable unfinished CodeTasks exist", () => {
    const gate = evaluateIntegrationButtonGate({
      summary: summary({ runnableCount: 2, integrationReadyCount: 13 }),
      finalWiringReady: true,
    });
    expect(gate.canRun).toBe(false);
    expect(gate.blockReason).toBe("runnable_tasks_exist");
    expect(gate.userMessage).toBe(INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE);
  });

  it("blocks when final wiring is not ready", () => {
    const gate = evaluateIntegrationButtonGate({
      summary: summary(),
      finalWiringReady: false,
    });
    expect(gate.canRun).toBe(false);
    expect(gate.blockReason).toBe("final_wiring_not_ready");
  });

  it("uses authoritative summary when client summary is stale (runnable mismatch)", () => {
    const authoritative = summary({ runnableCount: 0, integrationReadyCount: 15 });
    const staleClient = summary({ runnableCount: 3, integrationReadyCount: 12 });
    const gate = evaluateIntegrationButtonGate({
      summary: authoritative,
      clientSummary: staleClient,
      finalWiringReady: true,
    });
    expect(gate.canRun).toBe(true);
  });

  it("does not block integration only because integrationReadyCount is less than totalCount", () => {
    const gate = evaluateIntegrationButtonGate({
      summary: summary({
        totalCount: 20,
        integrationReadyCount: 15,
        integrationReadyCodeTaskIds: Array.from({ length: 15 }, (_, i) => `CODE-${i + 1}`),
      }),
      finalWiringReady: true,
      selectedCount: 0,
    });
    expect(gate.canRun).toBe(true);
    expect(gate.blockReason).toBeNull();
  });
});
