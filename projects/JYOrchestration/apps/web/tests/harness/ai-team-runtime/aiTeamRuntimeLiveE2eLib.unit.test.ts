import { describe, expect, it } from "vitest";

import {
  EXPECTED_TIMELINE_STAGES,
  defaultLiveE2eEvidenceDir,
  findSensitiveEvidenceLines,
  formatMissingEnvMessage,
  missingRequiredLiveE2eEnv,
  overallResultFromChecks,
  parseEvidenceConclusionFromMarkdown,
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

  it("formatMissingEnvMessage lists missing vars", () => {
    expect(formatMissingEnvMessage(["JYO_TASK_ID"])).toContain("JYO_TASK_ID");
  });

  it("parseEvidenceConclusionFromMarkdown extracts result", () => {
    const md = "## 결론\n\n- Live E2E 결과: **PASS**\n";
    expect(parseEvidenceConclusionFromMarkdown(md)).toBe("PASS");
  });

  it("findSensitiveEvidenceLines flags session cookie patterns", () => {
    const hits = findSensitiveEvidenceLines("Cookie: next-auth.session-token=abc");
    expect(hits.length).toBeGreaterThan(0);
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

  it("defaultLiveE2eEvidenceDir resolves under JYOrchestration docs", () => {
    const dir = defaultLiveE2eEvidenceDir();
    expect(dir.replace(/\\/g, "/")).toMatch(/JYOrchestration\/docs\/runtime\/evidence$/);
  });
});
