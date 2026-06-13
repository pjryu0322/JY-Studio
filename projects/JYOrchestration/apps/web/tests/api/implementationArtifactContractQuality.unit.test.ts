import { describe, expect, it } from "vitest";
import { buildSampleDataArtifactContract } from "@/lib/prototype/implementationArtifactContract";
import {
  buildCustomSummaryFieldContract,
  evaluateCodeTaskArtifactContractQuality,
} from "@/lib/prototype/implementationArtifactContractQuality";
import {
  evaluateActualPreviewSampleDataFileQuality,
  evaluateActualPreviewSampleDataQuality,
} from "@/lib/prototype/actualPreviewSampleDataQualityGate";

const SAMPLE_WITH_HIGHLIGHTS = `
export const sampleMeetingFiles = [
  { id: "m1", name: "a.mp3", duration: "1m", uploadedAt: "2026-06-09", status: "draft_ready" },
];
export const sampleParticipants = [
  { id: "p1", name: "A", role: "PM" },
  { id: "p2", name: "B", role: "Dev" },
];
export const sampleTranscriptSegments = [
  { id: "t1", speakerId: "p1", speakerName: "A", timestamp: "00:01", text: "one" },
  { id: "t2", speakerId: "p2", speakerName: "B", timestamp: "00:02", text: "two" },
  { id: "t3", speakerId: "p1", speakerName: "A", timestamp: "00:03", text: "three" },
];
export const sampleMeetingSummary = {
  meetingTitle: "회의",
  date: "2026-06-09",
  overview: "개요 텍스트",
  highlights: ["a", "b", "c", "d"],
};
export const sampleDecisions = [{ id: "d1", text: "ok" }];
export const sampleActionItems = [{ id: "a1", task: "t", owner: "o", dueDate: "d", status: "todo" }];
export const sampleDraftTimeline = [
  { id: "1", step: "s1", status: "done", description: "d1" },
  { id: "2", step: "s2", status: "done", description: "d2" },
];
`;

describe("implementationArtifactContractQuality", () => {
  it("passes sample data quality when contract expects sampleMeetingSummary.highlights", () => {
    const contract = buildSampleDataArtifactContract();
    const result = evaluateCodeTaskArtifactContractQuality({
      contract,
      repositoryFilePaths: ["src/data/sampleData.ts", "src/types/meeting.ts"],
      sampleDataFileContent: SAMPLE_WITH_HIGHLIGHTS,
      githubHeadCommitVerified: true,
    });
    expect(result.ok).toBe(true);
    expect(result.passedChecks.some((c) => c.includes("highlights"))).toBe(true);
    expect(result.missing.join(" ")).not.toContain("keyPoints");
  });

  it("does not require hardcoded sampleMeetingSummary.keyPoints", () => {
    const result = evaluateActualPreviewSampleDataFileQuality({
      repositoryFilePaths: ["src/data/sampleData.ts", "src/types/meeting.ts"],
      sampleDataFileContent: SAMPLE_WITH_HIGHLIGHTS,
      githubHeadCommitVerified: true,
    });
    expect(result.ok).toBe(true);
    expect(result.missing.join(" ")).not.toMatch(/keyPoints/);
  });

  it("supports different summary field names through artifact contracts", () => {
    const highlightsContract = buildCustomSummaryFieldContract({
      codeTaskId: "A",
      summaryExportName: "sampleMeetingSummary",
      summaryArrayField: "highlights",
      minHighlights: 2,
    });
    const keyPointsContract = buildCustomSummaryFieldContract({
      codeTaskId: "B",
      summaryExportName: "sampleMeetingSummary",
      summaryArrayField: "keyPoints",
      minHighlights: 2,
    });
    const insightsContract = buildCustomSummaryFieldContract({
      codeTaskId: "C",
      summaryExportName: "sampleMeetingSummary",
      summaryArrayField: "insights",
      minHighlights: 2,
    });

    const withHighlights = `
export const sampleMeetingSummary = { overview: "o", highlights: ["1", "2"] };
`;
    const withKeyPoints = `
export const sampleMeetingSummary = { overview: "o", keyPoints: ["1", "2"] };
`;
    const withInsights = `
export const sampleMeetingSummary = { overview: "o", insights: ["1", "2"] };
`;

    expect(
      evaluateCodeTaskArtifactContractQuality({
        contract: highlightsContract,
        repositoryFilePaths: ["src/data/sampleData.ts"],
        sampleDataFileContent: withHighlights,
        githubHeadCommitVerified: true,
      }).ok,
    ).toBe(true);
    expect(
      evaluateCodeTaskArtifactContractQuality({
        contract: keyPointsContract,
        repositoryFilePaths: ["src/data/sampleData.ts"],
        sampleDataFileContent: withKeyPoints,
        githubHeadCommitVerified: true,
      }).ok,
    ).toBe(true);
    expect(
      evaluateCodeTaskArtifactContractQuality({
        contract: insightsContract,
        repositoryFilePaths: ["src/data/sampleData.ts"],
        sampleDataFileContent: withInsights,
        githubHeadCommitVerified: true,
      }).ok,
    ).toBe(true);
  });

  it("reports preview wiring as integration_required instead of failing data CodeTask", () => {
    const r = evaluateActualPreviewSampleDataQuality({
      repositoryFilePaths: ["src/data/sampleData.ts", "src/types/meeting.ts"],
      sampleDataFileContent: SAMPLE_WITH_HIGHLIGHTS,
      workspaceSourceContents: ["업로드된 회의 녹취 파일이 여기에 표시됩니다."],
      githubHeadCommitVerified: true,
    });
    expect(r.ok).toBe(true);
    expect(r.integrationRequired?.length).toBeGreaterThan(0);
    expect(r.issues?.filter((i) => i.level === "fail").length ?? 0).toBe(0);
    expect(r.missing).not.toContain("placeholder_only_primary_panels");
  });

  it("does not fail quality before github branch head commit is verified", () => {
    const contract = buildSampleDataArtifactContract();
    const result = evaluateCodeTaskArtifactContractQuality({
      contract,
      repositoryFilePaths: [],
      githubHeadCommitVerified: false,
    });
    expect(result.status).toBe("pending");
    expect(result.missing).toHaveLength(0);
    expect(result.ok).toBe(false);
  });
});
