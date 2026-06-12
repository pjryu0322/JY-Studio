import { describe, expect, it } from "vitest";
import {
  evaluateActualPreviewSampleDataFileQuality,
  evaluateActualPreviewSampleDataQuality,
  isIntegrationSampleDataArtifactFailure,
} from "@/lib/prototype/actualPreviewSampleDataQualityGate";

const VALID_SAMPLE = `
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
  title: "회의",
  date: "2026-06-09",
  overview: "개요 텍스트",
  keyPoints: ["a", "b"],
};
export const sampleDecisions = [{ id: "d1", text: "ok" }];
export const sampleActionItems = [{ id: "a1", task: "t", owner: "o", dueDate: "d", status: "todo" }];
export const sampleDraftTimeline = [
  { id: "1", step: "s1", status: "done", description: "d1" },
  { id: "2", step: "s2", status: "done", description: "d2" },
];
`;

describe("actualPreviewSampleDataQualityGate", () => {
  it("fails when sampleData.ts is missing", () => {
    const r = evaluateActualPreviewSampleDataQuality({ repositoryFilePaths: [] });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("src/data/sampleData.ts");
  });

  it("fails when meeting files array is empty", () => {
    const r = evaluateActualPreviewSampleDataQuality({
      repositoryFilePaths: ["src/data/sampleData.ts"],
      sampleDataFileContent: `
export const sampleMeetingFiles = [];
export const sampleParticipants = [{ id: "p1", name: "A", role: "r" }, { id: "p2", name: "B", role: "r" }];
export const sampleTranscriptSegments = [
  { id: "t1", speakerId: "p1", speakerName: "A", timestamp: "00:01", text: "one" },
  { id: "t2", speakerId: "p2", speakerName: "B", timestamp: "00:02", text: "two" },
  { id: "t3", speakerId: "p1", speakerName: "A", timestamp: "00:03", text: "three" },
];
export const sampleMeetingSummary = { title: "t", date: "d", overview: "o", keyPoints: ["a", "b"] };
export const sampleDecisions = [];
export const sampleActionItems = [];
export const sampleDraftTimeline = [
  { id: "1", step: "s1", status: "done", description: "d1" },
  { id: "2", step: "s2", status: "done", description: "d2" },
];
`,
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("sampleMeetingFiles>=1");
  });

  it("passes with sufficient sample data", () => {
    const r = evaluateActualPreviewSampleDataQuality({
      repositoryFilePaths: ["src/data/sampleData.ts"],
      sampleDataFileContent: VALID_SAMPLE,
    });
    expect(r.ok).toBe(true);
  });

  it("fails when placeholder-only text remains in workspace panels", () => {
    const r = evaluateActualPreviewSampleDataQuality({
      repositoryFilePaths: ["src/data/sampleData.ts"],
      sampleDataFileContent: VALID_SAMPLE,
      workspaceSourceContents: ["업로드된 회의 녹취 파일이 여기에 표시됩니다."],
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("placeholder_only_primary_panels");
  });

  it("integration merge gate ignores panel placeholders when sample file passes", () => {
    const fileOnly = evaluateActualPreviewSampleDataFileQuality({
      repositoryFilePaths: ["src/data/sampleData.ts"],
      sampleDataFileContent: VALID_SAMPLE,
    });
    expect(fileOnly.ok).toBe(true);
    const full = evaluateActualPreviewSampleDataQuality({
      repositoryFilePaths: ["src/data/sampleData.ts"],
      sampleDataFileContent: VALID_SAMPLE,
      workspaceSourceContents: ["업로드된 회의 녹취 파일이 여기에 표시됩니다."],
    });
    expect(isIntegrationSampleDataArtifactFailure(full)).toBe(false);
  });
});
