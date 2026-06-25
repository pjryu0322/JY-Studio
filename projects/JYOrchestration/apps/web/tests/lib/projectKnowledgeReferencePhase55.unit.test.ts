import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeReferenceEligibility } from "@/lib/project-knowledge/projectKnowledgeReferenceEligibilityService";
import { parseKnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";
import {
  graphSnapshotPurposeFromMilestone,
  normalizeGraphSnapshotPurpose,
  normalizeKnowledgeNodeLifecycle,
} from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import { buildKnowledgeNodeReferenceView, computeKnowledgeNodeReusability } from "@/lib/project-knowledge/projectKnowledgeReferenceNodeMeta";
import {
  assessKnowledgeNodeSensitivity,
  assessReferenceSafety,
  isTextSafeForReferencePackage,
} from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

describe("normalizeKnowledgeNodeLifecycle", () => {
  it("maps CANDIDATE to AI_PROPOSED", () => {
    expect(normalizeKnowledgeNodeLifecycle({ lifecycleStatus: "CANDIDATE" })).toBe("AI_PROPOSED");
  });

  it("maps PROJECTED to USER_APPROVED", () => {
    expect(normalizeKnowledgeNodeLifecycle({ lifecycleStatus: "PROJECTED" })).toBe("USER_APPROVED");
  });

  it("uses projectionKey approved-candidate prefix", () => {
    expect(
      normalizeKnowledgeNodeLifecycle({ projectionKey: "approved-candidate:abc", lifecycleStatus: "X" }),
    ).toBe("USER_APPROVED");
  });
});

describe("graph snapshot purpose", () => {
  it("defaults unknown purpose to REPLAY", () => {
    expect(normalizeGraphSnapshotPurpose(undefined)).toBe("REPLAY");
    expect(normalizeGraphSnapshotPurpose("nope")).toBe("REPLAY");
  });

  it("maps milestones to reference candidate", () => {
    expect(graphSnapshotPurposeFromMilestone("graph_projection")).toBe("REFERENCE_CANDIDATE");
    expect(graphSnapshotPurposeFromMilestone("proposal_approval")).toBe("REFERENCE_CANDIDATE");
    expect(graphSnapshotPurposeFromMilestone("conversation_sync")).toBe("REPLAY");
  });

  it("parses purpose from snapshot JSON", () => {
    const snap = parseKnowledgeGraphRevisionSnapshot({
      purpose: "REFERENCE_CANDIDATE",
      nodes: [{ entityKey: "a", nodeType: "Actor", title: "User" }],
      edges: [],
    });
    expect(snap.purpose).toBe("REFERENCE_CANDIDATE");
    expect(snap.nodes).toHaveLength(1);
  });

  it("legacy snapshot without purpose defaults to REPLAY", () => {
    const snap = parseKnowledgeGraphRevisionSnapshot({ nodes: [], edges: [] });
    expect(snap.purpose).toBe("REPLAY");
  });

  it("does not treat REPLAY snapshot as reference by purpose alone", () => {
    const snap = parseKnowledgeGraphRevisionSnapshot({ purpose: "REPLAY", nodes: [], edges: [] });
    expect(snap.purpose).toBe("REPLAY");
    const nodes = [
      { lifecycle: "USER_APPROVED", nodeType: "Actor", reusable: true, safeForReference: true },
      { lifecycle: "USER_APPROVED", nodeType: "ServiceFlow", reusable: true, safeForReference: true },
      { lifecycle: "USER_APPROVED", nodeType: "Feature", reusable: true, safeForReference: true },
    ];
    const eligibility = computeReferenceEligibility(nodes, {
      hasReferenceCandidateSnapshot: false,
      hasReferencePackageSnapshot: false,
    });
    expect(eligibility.level).toBe("READY_FOR_SNAPSHOT");
  });
});

describe("computeReferenceEligibility", () => {
  const approvedActor = {
    lifecycle: "USER_APPROVED",
    nodeType: "Actor",
    reusable: true,
    safeForReference: true,
  };
  const approvedFlow = {
    lifecycle: "USER_APPROVED",
    nodeType: "ServiceFlow",
    reusable: true,
    safeForReference: true,
  };
  const approvedFeature = {
    lifecycle: "USER_APPROVED",
    nodeType: "Feature",
    reusable: true,
    safeForReference: true,
  };

  it("returns NONE when no reusable nodes", () => {
    const result = computeReferenceEligibility([]);
    expect(result.level).toBe("NONE");
    expect(result.eligible).toBe(false);
  });

  it("returns PARTIAL when fewer than three reusable nodes", () => {
    const result = computeReferenceEligibility([approvedActor, approvedFlow]);
    expect(result.level).toBe("PARTIAL");
  });

  it("returns READY_FOR_SNAPSHOT when thresholds met without snapshot", () => {
    const result = computeReferenceEligibility(
      [approvedActor, approvedFlow, approvedFeature, approvedActor],
      { hasReferenceCandidateSnapshot: false, hasReferencePackageSnapshot: false },
    );
    expect(result.level).toBe("READY_FOR_SNAPSHOT");
    expect(result.eligible).toBe(false);
  });

  it("returns SNAPSHOT_READY when reference candidate snapshot exists", () => {
    const result = computeReferenceEligibility(
      [approvedActor, approvedFlow, approvedFeature],
      { hasReferenceCandidateSnapshot: true, hasReferencePackageSnapshot: false },
    );
    expect(result.level).toBe("SNAPSHOT_READY");
    expect(result.eligible).toBe(true);
  });
});

describe("buildKnowledgeNodeReferenceView", () => {
  it("exposes user labels without internal ids", () => {
    const view = buildKnowledgeNodeReferenceView({
      nodeType: "Actor",
      title: "고객",
      summary: "주요 사용자",
      lifecycleStatus: "PROJECTED",
    });
    expect(view.lifecycleLabel).toBe("사용자 승인됨");
    expect(view.reusable).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/revisionId|eventId/i);
  });

  it("marks draft nodes as not reusable", () => {
    const view = buildKnowledgeNodeReferenceView({
      nodeType: "Feature",
      title: "초안 기능",
      lifecycleStatus: "CANDIDATE",
    });
    expect(view.reusable).toBe(false);
  });

  it("blocks reusability when raw conversation excerpt is present", () => {
    const sensitivity = assessReferenceSafety({
      title: "Actor",
      summary: null,
      containsConversationExcerpt: true,
    });
    const reusability = computeKnowledgeNodeReusability("USER_APPROVED", sensitivity, "Actor");
    expect(reusability.reusable).toBe(false);
  });
});

describe("sanitization", () => {
  it("flags secrets in sensitivity assessment", () => {
    const s = assessKnowledgeNodeSensitivity({ title: "api_key=abc", summary: null });
    expect(s.safeForReference).toBe(false);
  });

  it("rejects uuid-like reference package text", () => {
    expect(isTextSafeForReferencePackage("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isTextSafeForReferencePackage("정상 라벨")).toBe(true);
  });
});
