import { describe, expect, it } from "vitest";
import {
  evaluateIntegrationBlockedByRunnableBoardSummary,
  INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE,
} from "@/lib/prototype/implementationBoardIntegrationGate";

describe("evaluateIntegrationBlockedByRunnableBoardSummary", () => {
  it("blocks when runnableCount > 0", () => {
    const gate = evaluateIntegrationBlockedByRunnableBoardSummary({ runnableCount: 1 });
    expect(gate.ok).toBe(false);
    expect(gate.message).toBe(INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE);
  });

  it("allows when no runnable remain", () => {
    const gate = evaluateIntegrationBlockedByRunnableBoardSummary({ runnableCount: 0 });
    expect(gate.ok).toBe(true);
    expect(gate.message).toBeNull();
  });
});
