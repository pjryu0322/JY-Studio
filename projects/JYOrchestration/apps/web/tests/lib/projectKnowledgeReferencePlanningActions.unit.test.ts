import { describe, expect, it } from "vitest";
import {
  buildReferenceInfoViewMessageBody,
  REFERENCE_PLANNING_CHIP_CONTINUE,
} from "@/lib/project-knowledge/projectKnowledgeReferenceContextBuilder";
import {
  buildReferenceClearSelectionApiPath,
  buildReferenceMaterializeApiPath,
  clearReferenceSelectionStatePatch,
  isReferenceContextLegacyMissing,
  readReferenceSelectionSummaryFromState,
  shouldSendReferencePlanningContinueToAi,
  REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";
import { resolveReferencePromptContextBlockForOrchestration } from "@/lib/requirements/singleChatOrchestrationOpenAI";
import { buildMaterializedReferenceContextFromSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";

describe("reference planning chip helpers", () => {
  it("builds DELETE reference-selection API path", () => {
    expect(buildReferenceClearSelectionApiPath("proj-1")).toBe("/api/projects/proj-1/reference-selection");
  });

  it("builds POST reference-selection materialize API path", () => {
    expect(buildReferenceMaterializeApiPath("proj-1")).toBe(
      "/api/projects/proj-1/reference-selection/materialize",
    );
  });

  it("clears reference selection fields in state patch", () => {
    expect(clearReferenceSelectionStatePatch()).toEqual({
      referenceSelectionV1: null,
      referenceSelectionSummaryV1: null,
      referenceSelectionWelcomeShownAt: null,
      materializedReferenceContextV1: null,
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

  it("detects legacy missing materialized context", () => {
    expect(
      isReferenceContextLegacyMissing({
        referenceSelectionV1: {
          referenceSnapshotIds: ["snap"],
          selectedAt: "2026-06-01T00:00:00.000Z",
          source: "USER_SELECTED",
        },
      }),
    ).toBe(true);
    const materialized = buildMaterializedReferenceContextFromSnapshot({
      sourceProjectTitle: "P",
      snapshotTitle: "S",
      snapshotPurpose: "REFERENCE_CANDIDATE",
      graphSnapshot: {
        purpose: "REFERENCE_CANDIDATE",
        nodes: [],
        edges: [],
      },
    });
    expect(
      isReferenceContextLegacyMissing({
        referenceSelectionV1: {
          referenceSnapshotIds: ["snap"],
          selectedAt: "2026-06-01T00:00:00.000Z",
          source: "USER_SELECTED",
        },
        materializedReferenceContextV1: materialized,
      }),
    ).toBe(false);
  });

  it("legacy diagnostic message avoids internal id wording", () => {
    expect(REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE).not.toMatch(
      /sourceSnapshotId|revisionId|entityKey/i,
    );
    expect(REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE).not.toContain("보정");
    expect(REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE).not.toContain("재선택");
    expect(REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE).toContain("현재 프로젝트");
  });
});

describe("resolveReferencePromptContextBlockForOrchestration", () => {
  it("wraps reference context as separate section without touching projectDescription", () => {
    const block = resolveReferencePromptContextBlockForOrchestration({
      referencePromptContextBlock: "[참조 프로젝트 컨텍스트]\nActor",
    });
    expect(block).toContain("[reference_context]");
    expect(block).toContain("Actor");
  });

  it("returns empty when no reference block", () => {
    expect(resolveReferencePromptContextBlockForOrchestration({})).toBe("");
  });
});
