import { describe, expect, it } from "vitest";
import { buildMaterializedReferenceContextFromSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import { resolveReferencePlanningNoticeCandidate } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningNotice";
import {
  REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE,
  REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";

describe("resolveReferencePlanningNoticeCandidate", () => {
  const nowIso = "2026-06-03T00:00:00.000Z";

  it("returns legacy missing notice when materialized context is absent", () => {
    const candidate = resolveReferencePlanningNoticeCandidate({
      workspaceState: {
        referenceSelectionV1: {
          referenceSnapshotIds: ["snap"],
          selectedAt: nowIso,
          source: "USER_SELECTED",
        },
      },
      existingMessages: [],
      nowIso,
    });
    expect(candidate?.kind).toBe("LEGACY_MISSING");
    expect(candidate?.body).toContain("현재 프로젝트");
  });

  it("skips legacy notice when already shown", () => {
    const candidate = resolveReferencePlanningNoticeCandidate({
      workspaceState: {
        referenceSelectionV1: {
          referenceSnapshotIds: ["snap"],
          selectedAt: nowIso,
          source: "USER_SELECTED",
        },
      },
      existingMessages: [{ meta: { internalType: REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE } }],
      nowIso,
    });
    expect(candidate).toBeNull();
  });

  it("returns null when materialized context exists and welcome already satisfied", () => {
    const materialized = buildMaterializedReferenceContextFromSnapshot({
      sourceProjectTitle: "A",
      snapshotTitle: "S",
      snapshotPurpose: "REFERENCE_CANDIDATE",
      graphSnapshot: { purpose: "REFERENCE_CANDIDATE", nodes: [], edges: [] },
    });
    const candidate = resolveReferencePlanningNoticeCandidate({
      workspaceState: {
        referenceSelectionSummaryV1: {
          sourceProjectTitle: "A",
          snapshotTitle: "S",
          readiness: "READY",
          actorCount: 1,
          serviceFlowCount: 0,
          featureCount: 0,
          graphReusableNodeCount: 1,
        },
        materializedReferenceContextV1: materialized,
        referenceSelectionWelcomeShownAt: nowIso,
      },
      existingMessages: [],
      nowIso,
    });
    expect(candidate).toBeNull();
  });

  it("returns welcome when summary exists and not legacy", () => {
    const materialized = buildMaterializedReferenceContextFromSnapshot({
      sourceProjectTitle: "A",
      snapshotTitle: "S",
      snapshotPurpose: "REFERENCE_CANDIDATE",
      graphSnapshot: { purpose: "REFERENCE_CANDIDATE", nodes: [], edges: [] },
    });
    const candidate = resolveReferencePlanningNoticeCandidate({
      workspaceState: {
        referenceSelectionSummaryV1: {
          sourceProjectTitle: "A",
          snapshotTitle: "S",
          readiness: "READY",
          actorCount: 1,
          serviceFlowCount: 0,
          featureCount: 0,
          graphReusableNodeCount: 1,
        },
        materializedReferenceContextV1: materialized,
      },
      existingMessages: [],
      nowIso,
    });
    expect(candidate?.kind).toBe("WELCOME");
  });

  it("skips welcome when already shown", () => {
    const materialized = buildMaterializedReferenceContextFromSnapshot({
      sourceProjectTitle: "A",
      snapshotTitle: "S",
      snapshotPurpose: "REFERENCE_CANDIDATE",
      graphSnapshot: { purpose: "REFERENCE_CANDIDATE", nodes: [], edges: [] },
    });
    const candidate = resolveReferencePlanningNoticeCandidate({
      workspaceState: {
        referenceSelectionSummaryV1: {
          sourceProjectTitle: "A",
          snapshotTitle: "S",
          readiness: "READY",
          actorCount: 0,
          serviceFlowCount: 0,
          featureCount: 0,
          graphReusableNodeCount: 0,
        },
        materializedReferenceContextV1: materialized,
      },
      existingMessages: [{ meta: { internalType: REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE } }],
      nowIso,
    });
    expect(candidate).toBeNull();
  });
});
