import { describe, expect, it } from "vitest";
import { buildIntegrationGateBlockedApiBody } from "@/lib/prototype/implementationBoardIntegrationGate";

describe("buildIntegrationGateBlockedApiBody", () => {
  it("returns structured block reason when server integration gate blocks", () => {
    const body = buildIntegrationGateBlockedApiBody({
      blockReason: "runnable_tasks_exist",
      summary: {
        totalCount: 15,
        runnableCount: 2,
        integrationReadyCount: 13,
        selectedRunnableCount: 0,
        selectedRunnableCodeTaskIds: [],
        integrationReadyCodeTaskIds: ["A"],
      },
      userMessage: "blocked",
      verifiedCount: 13,
    });
    expect(body.ok).toBe(false);
    expect(body.blockReason).toBe("runnable_tasks_exist");
    expect(body.summary.runnableCount).toBe(2);
    expect(body.summary.integrationReadyCount).toBe(13);
    expect(body.summary.verifiedCount).toBe(13);
  });
});
