import { describe, expect, it } from "vitest";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { MEETING_WORKSPACE_SAMPLE_DATA_SPEC_V1, parseSampleDataSpecV1, evaluateSampleDataFileContentAgainstSpec } from "@/lib/featurePlanning/sampleDataSpecV1";
import { buildFallbackPlanningChecklist } from "@/lib/featurePlanning/featurePlanningDynamicChecklist";
import { applySampleDataSpecToPrototypeReadiness } from "@/lib/featurePlanning/featurePlanningSampleDataSync";
import { buildImplementationSeedFromPlanning } from "@/lib/requirements/implementationSeed";
import { buildSampleDataAcceptanceCriteriaFromSpec } from "@/lib/prototype/sampleDataCodeTaskPlanner";
import { evaluateActualPreviewSampleDataFileQuality } from "@/lib/prototype/actualPreviewSampleDataQualityGate";

describe("sampleDataSpecV1 planning artifact", () => {
  it("parses and round-trips via requirementsStateJson", () => {
    const parsed = parseRequirementsStateJson({
      sampleDataSpecV1: MEETING_WORKSPACE_SAMPLE_DATA_SPEC_V1,
    });
    expect(parsed.sampleDataSpecV1?.entities.length).toBeGreaterThan(0);
    expect(parseSampleDataSpecV1(parsed.sampleDataSpecV1)?.purpose).toContain("Preview");
  });
});

describe("featurePlanning SAMPLE_DATA checklist", () => {
  it("fallback checklist includes sample_data_preview area", () => {
    const cl = buildFallbackPlanningChecklist({ stepTitle: "회의록 정리", actorNames: ["사용자"] });
    expect(cl.areas.some((a) => a.areaKey === "sample_data_preview")).toBe(true);
    expect(cl.areas.find((a) => a.areaKey === "sample_data_preview")?.slots.length).toBeGreaterThan(3);
  });
});

describe("prototypeReadiness sampleData", () => {
  it("blocks READY when spec is missing", () => {
    const out = applySampleDataSpecToPrototypeReadiness({
      prototypeReadiness: { status: "READY", missingItems: [], notes: "" },
      sampleDataSpec: null,
    });
    expect(out.status).not.toBe("READY");
    expect(out.sampleDataReadiness?.status).toBe("INSUFFICIENT");
  });

  it("allows READY when meeting spec is complete", () => {
    const out = applySampleDataSpecToPrototypeReadiness({
      prototypeReadiness: { status: "READY", missingItems: [], notes: "" },
      sampleDataSpec: MEETING_WORKSPACE_SAMPLE_DATA_SPEC_V1,
    });
    expect(out.status).toBe("READY");
    expect(out.sampleDataReadiness?.status).toBe("READY");
  });
});

describe("implementationSeed sampleDataSpecV1", () => {
  it("passes sampleDataSpecV1 from build input to seed", () => {
    const seed = buildImplementationSeedFromPlanning({
      projectId: "p1",
      orchestration: null,
      definitions: [],
      sampleDataSpecV1: MEETING_WORKSPACE_SAMPLE_DATA_SPEC_V1,
    });
    expect(seed.sampleDataSpecV1?.entities[0]?.key).toBe("meetingFiles");
  });
});

describe("sampleData CodeTask planner spec", () => {
  it("builds acceptance criteria from spec", () => {
    const lines = buildSampleDataAcceptanceCriteriaFromSpec(MEETING_WORKSPACE_SAMPLE_DATA_SPEC_V1);
    expect(lines.some((l) => l.includes("meetingFiles") || l.includes("회의 파일"))).toBe(true);
    expect(lines.some((l) => l.includes("uploaded"))).toBe(true);
  });
});

describe("actualPreviewSampleDataQuality vs spec", () => {
  const thinSample = `
export const sampleMeetingFiles = [{ id: "1", title: "t", fileName: "a", uploadedAt: "x", status: "uploaded", durationMinutes: 1 }];
export const sampleParticipants = [{ id: "p1", name: "A", role: "r", department: "d" }];
export const sampleTranscriptSegments = [{ meetingId: "1", speaker: "A", text: "t", timestamp: "0" }];
export const sampleMeetingSummary = { meetingId: "1", summary: "s", actionItems: [], decisions: [] };
`;

  it("fails spec minimumCount when spec is provided", () => {
    const specCheck = evaluateSampleDataFileContentAgainstSpec({
      spec: MEETING_WORKSPACE_SAMPLE_DATA_SPEC_V1,
      sampleDataFileContent: thinSample,
    });
    expect(specCheck.ok).toBe(false);
    expect(specCheck.missing.some((m) => m.includes("meetingFiles"))).toBe(true);

    const r = evaluateActualPreviewSampleDataFileQuality({
      repositoryFilePaths: ["src/data/sampleData.ts", "src/types/meeting.ts"],
      sampleDataFileContent: thinSample,
      githubHeadCommitVerified: true,
      sampleDataSpecV1: MEETING_WORKSPACE_SAMPLE_DATA_SPEC_V1,
    });
    expect(r.ok).toBe(false);
  });
});
