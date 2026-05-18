import { describe, expect, it } from "vitest";

import {
  EXPECTED_TIMELINE_STAGES,
  missingRequiredLiveE2eEnv,
  overallResultFromChecks,
  parseLiveE2eEnv,
  validateExecutionRunsResponse,
} from "../../../scripts/lib/ai-team-runtime-live-e2e-lib.mjs";

describe("ai-team-runtime-live-e2e-lib", () => {
  it("reports missing required env fields", () => {
    expect(missingRequiredLiveE2eEnv({ projectId: "", taskId: "t", sessionCookie: "c" })).toEqual([
      "JYO_PROJECT_ID",
    ]);
  });

  it("validates timeline length and stage order", () => {
    const timeline = EXPECTED_TIMELINE_STAGES.map((stage) => ({
      id: stage,
      stage,
      titleKo: stage,
      status: "pending",
    }));

    const checks = validateExecutionRunsResponse({
      success: true,
      data: [{ teamRuntime: { timeline } }],
    });

    expect(checks.find((c) => c.name === "timeline length = 7")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "stage order")?.ok).toBe(true);
    expect(overallResultFromChecks(checks)).toBe("PASS");
  });

  it("parseLiveE2eEnv reads flags", () => {
    const config = parseLiveE2eEnv({
      JYO_PROJECT_ID: "p1",
      JYO_TASK_ID: "t1",
      JYO_SESSION_COOKIE: "cookie",
      JYO_APPROVE: "1",
    });
    expect(config.projectId).toBe("p1");
    expect(config.doApprove).toBe(true);
  });
});
