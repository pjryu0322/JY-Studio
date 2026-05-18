import { describe, expect, it } from "vitest";

import {
  EXPECTED_TIMELINE_STAGES,
  LIVE_E2E_EVIDENCE_FILENAME_PREFIX,
  defaultLiveE2eEvidenceDir,
  findSensitiveEvidenceLines,
  formatLiveE2eEvidenceFilename,
  formatLiveE2eCheckLines,
  formatMissingEnvMessage,
  formatScanLiveE2eReport,
  jyoOrchestrationRoot,
  liveE2eHttpErrorMessage,
  missingRequiredLiveE2eEnv,
  overallResultFromChecks,
  parseEvidenceConclusionFromMarkdown,
  parseExpectTimelineFlag,
  parseLiveE2eEnv,
  resolveLiveE2eEvidenceDir,
  validateExecutionRunsResponse,
} from "../../../scripts/lib/ai-team-runtime-live-e2e-lib.mjs";
import {
  LiveE2eCliError,
  runLiveE2eEvidenceCheck,
} from "../../../scripts/lib/ai-team-runtime-live-e2e-runner.mjs";

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

  it("findSensitiveEvidenceLines flags OpenAI-style keys", () => {
    const hits = findSensitiveEvidenceLines("note: sk-abcdefghijklmnopqrstuvwxyz123456");
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

  it("parseExpectTimelineFlag defaults true and respects 0/false", () => {
    expect(parseExpectTimelineFlag({})).toBe(true);
    expect(parseExpectTimelineFlag({ JYO_EXPECT_TIMELINE: "0" })).toBe(false);
    expect(parseExpectTimelineFlag({ JYO_EXPECT_TIMELINE: "false" })).toBe(false);
  });

  it("runLiveE2eEvidenceCheck rejects missing env", async () => {
    await expect(runLiveE2eEvidenceCheck({})).rejects.toBeInstanceOf(LiveE2eCliError);
  });

  it("defaultLiveE2eEvidenceDir resolves under JYOrchestration docs", () => {
    const dir = defaultLiveE2eEvidenceDir();
    expect(dir.replace(/\\/g, "/")).toMatch(/JYOrchestration\/docs\/runtime\/evidence$/);
  });

  it("jyoOrchestrationRoot matches evidence dir parent chain", () => {
    const root = jyoOrchestrationRoot().replace(/\\/g, "/");
    const evidence = defaultLiveE2eEvidenceDir().replace(/\\/g, "/");
    expect(evidence).toBe(`${root}/docs/runtime/evidence`);
  });

  it("formatLiveE2eEvidenceFilename uses expected prefix", () => {
    const name = formatLiveE2eEvidenceFilename(new Date("2026-05-18T10:11:12Z"));
    expect(name).toMatch(new RegExp(`^${LIVE_E2E_EVIDENCE_FILENAME_PREFIX}\\d{4}-\\d{2}-\\d{2}-\\d{6}\\.md$`));
  });

  it("resolveLiveE2eEvidenceDir honors JYO_EVIDENCE_DIR", () => {
    expect(resolveLiveE2eEvidenceDir({ JYO_EVIDENCE_DIR: "/tmp/evidence" })).toBe("/tmp/evidence");
  });

  it("formatLiveE2eCheckLines renders PASS/FAIL", () => {
    const lines = formatLiveE2eCheckLines([{ name: "timeline exists", ok: true, note: "" }]);
    expect(lines[0]).toBe("PASS  timeline exists");
  });

  it("liveE2eHttpErrorMessage maps auth failures", () => {
    const msg = liveE2eHttpErrorMessage({ res: { status: 401, ok: false }, json: {} }, "execution-runs");
    expect(msg).toContain("JYO_SESSION_COOKIE");
  });

  it("formatScanLiveE2eReport handles empty evidence dir", () => {
    const report = formatScanLiveE2eReport({
      evidenceDir: "/tmp/empty-evidence",
      files: [],
      latest: null,
      conclusion: null,
      sensitive: [],
    });
    expect(report.exitCode).toBe(0);
    expect(report.scanOk).toBe(false);
    expect(report.lines.join("\n")).toContain("Evidence files: 0");
    expect(report.lines.join("\n")).toContain("final-live-e2e-execution");
  });

  it("formatScanLiveE2eReport flags sensitive hits", () => {
    const report = formatScanLiveE2eReport({
      evidenceDir: "/tmp/ev",
      files: [{ name: "ai-team-runtime-live-e2e-2026-01-01-120000.md", path: "/tmp/ev/x.md", mtimeMs: 1 }],
      latest: { name: "ai-team-runtime-live-e2e-2026-01-01-120000.md", path: "/tmp/ev/x.md", mtimeMs: 1 },
      conclusion: "PASS",
      sensitive: [{ line: 1, text: "session-token=secret" }],
    });
    expect(report.exitCode).toBe(1);
    expect(report.scanOk).toBe(false);
    expect(report.lines.join("\n")).toContain("Sensitive pattern hits: 1");
  });
});
