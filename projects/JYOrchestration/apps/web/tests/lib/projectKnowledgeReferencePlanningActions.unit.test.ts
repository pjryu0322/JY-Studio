import { describe, expect, it } from "vitest";
import {
  buildReferenceInfoViewMessageBody,
  REFERENCE_PLANNING_CHIP_CONTINUE,
} from "@/lib/project-knowledge/projectKnowledgeReferenceContextBuilder";
import {
  buildReferenceClearSelectionApiPath,
  clearReferenceSelectionStatePatch,
  readReferenceSelectionSummaryFromState,
  shouldSendReferencePlanningContinueToAi,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";
import { mergeReferencePlanningContextIntoOrchestrationProjectDescription } from "@/lib/requirements/singleChatOrchestrationOpenAI";

describe("reference planning chip helpers", () => {
  it("builds DELETE reference-selection API path", () => {
    expect(buildReferenceClearSelectionApiPath("proj-1")).toBe("/api/projects/proj-1/reference-selection");
  });

  it("clears reference selection fields in state patch", () => {
    expect(clearReferenceSelectionStatePatch()).toEqual({
      referenceSelectionV1: null,
      referenceSelectionSummaryV1: null,
      referenceSelectionWelcomeShownAt: null,
    });
  });

  it("does not send continue chip to AI", () => {
    expect(shouldSendReferencePlanningContinueToAi(REFERENCE_PLANNING_CHIP_CONTINUE)).toBe(false);
  });

  it("builds info view body without internal ids", () => {
    const body = buildReferenceInfoViewMessageBody({
      sourceProjectTitle: "주문 서비스",
      snapshotTitle: "승인본",
      readiness: "READY",
      actorCount: 2,
      serviceFlowCount: 3,
      featureCount: 4,
      graphReusableNodeCount: 5,
    });
    expect(body).toContain("주문 서비스");
    expect(body).toContain("승인본");
    expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it("parses summary from requirements state", () => {
    const summary = readReferenceSelectionSummaryFromState({
      referenceSelectionSummaryV1: {
        sourceProjectTitle: "P",
        snapshotTitle: "S",
        readiness: "VERIFIED",
        actorCount: 1,
        serviceFlowCount: 1,
        featureCount: 1,
        graphReusableNodeCount: 1,
      },
    });
    expect(summary?.readiness).toBe("VERIFIED");
  });
});

describe("mergeReferencePlanningContextIntoOrchestrationProjectDescription", () => {
  it("appends reference block for orchestration prompts", () => {
    const merged = mergeReferencePlanningContextIntoOrchestrationProjectDescription("새 프로젝트", "[참조 프로젝트 정보]\nActor");
    expect(merged).toContain("새 프로젝트");
    expect(merged).toContain("[참조 프로젝트 정보]");
  });

  it("returns base description when reference block is empty", () => {
    expect(mergeReferencePlanningContextIntoOrchestrationProjectDescription("desc", "")).toBe("desc");
    expect(mergeReferencePlanningContextIntoOrchestrationProjectDescription("desc", undefined)).toBe("desc");
  });
});
