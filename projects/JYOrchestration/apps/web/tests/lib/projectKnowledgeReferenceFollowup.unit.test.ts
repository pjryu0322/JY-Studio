import { describe, expect, it } from "vitest";
import { computeReferenceEligibility } from "@/lib/project-knowledge/projectKnowledgeReferenceEligibilityService";
import {
  buildFallbackProjectGraphNodeReferenceMetadata,
  parseProjectGraphNodeReferenceMetadata,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMetadata";
import { toReferenceEligibilityNodeInput } from "@/lib/project-knowledge/projectKnowledgeReferenceNodeMeta";
import { assessReferenceSafety } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

describe("reference eligibility snapshot strictness", () => {
  const baseNodes = [
    { lifecycle: "USER_APPROVED", nodeType: "Actor", reusable: true, safeForReference: true },
    { lifecycle: "USER_APPROVED", nodeType: "ServiceFlow", reusable: true, safeForReference: true },
    { lifecycle: "USER_APPROVED", nodeType: "Feature", reusable: true, safeForReference: true },
  ];

  it("returns READY_FOR_SNAPSHOT when structure met but no reference snapshot", () => {
    const result = computeReferenceEligibility(baseNodes, {
      hasReferenceCandidateSnapshot: false,
      hasReferencePackageSnapshot: false,
    });
    expect(result.level).toBe("READY_FOR_SNAPSHOT");
    expect(result.eligible).toBe(false);
  });

  it("returns SNAPSHOT_READY when REFERENCE_CANDIDATE snapshot exists", () => {
    const result = computeReferenceEligibility(baseNodes, {
      hasReferenceCandidateSnapshot: true,
      hasReferencePackageSnapshot: false,
    });
    expect(result.level).toBe("SNAPSHOT_READY");
    expect(result.eligible).toBe(true);
  });

  it("returns VERIFIED when REFERENCE_PACKAGE snapshot exists", () => {
    const result = computeReferenceEligibility(baseNodes, {
      hasReferenceCandidateSnapshot: false,
      hasReferencePackageSnapshot: true,
    });
    expect(result.level).toBe("VERIFIED");
    expect(result.eligible).toBe(true);
  });
});

describe("reference metadata lifecycle source", () => {
  it("prefers metadata.reference.lifecycle when present", () => {
    const meta = parseProjectGraphNodeReferenceMetadata({
      reference: {
        lifecycle: "USER_APPROVED",
        provenance: { createdFrom: "USER_APPROVAL" },
        reusable: true,
        reusableAs: ["FEATURE"],
        sensitivity: {
          containsPersonalData: false,
          containsConfidentialData: false,
          containsRawConversation: false,
          containsInternalIds: false,
          safeForReference: true,
        },
      },
    });
    expect(meta?.lifecycle).toBe("USER_APPROVED");
    const mapped = toReferenceEligibilityNodeInput({
      nodeType: "Feature",
      title: "기능",
      metadata: {
        reference: {
          lifecycle: "USER_APPROVED",
          provenance: { createdFrom: "USER_APPROVAL" },
          reusable: true,
          reusableAs: ["FEATURE"],
          sensitivity: {
            containsPersonalData: false,
            containsConfidentialData: false,
            containsRawConversation: false,
            containsInternalIds: false,
            safeForReference: true,
          },
        },
      },
    });
    expect(mapped.reusable).toBe(true);
  });

  it("falls back when metadata.reference is absent", () => {
    const fallback = buildFallbackProjectGraphNodeReferenceMetadata({
      nodeType: "Feature",
      title: "기능",
      lifecycleStatus: "CANDIDATE",
      projectionKey: "k",
    });
    expect(fallback.lifecycle).toBe("AI_PROPOSED");
    expect(fallback.reusable).toBe(false);
  });
});

describe("assessReferenceSafety unified detector", () => {
  it("flags UUID as internal ids", () => {
    const s = assessReferenceSafety({ title: "550e8400-e29b-41d4-a716-446655440000" });
    expect(s.containsInternalIds).toBe(true);
    expect(s.safeForReference).toBe(false);
  });

  it("flags eventId-like strings", () => {
    const s = assessReferenceSafety({ summary: "linked eventId=abc" });
    expect(s.safeForReference).toBe(false);
  });

  it("flags raw conversation excerpt", () => {
    const s = assessReferenceSafety({ title: "ok", containsConversationExcerpt: true });
    expect(s.safeForReference).toBe(false);
  });
});

describe("reusableAs propagation", () => {
  it("keeps FEATURE in toReferenceEligibilityNodeInput from metadata.reference", () => {
    const mapped = toReferenceEligibilityNodeInput({
      nodeType: "Custom",
      title: "기능",
      metadata: {
        reference: {
          lifecycle: "USER_APPROVED",
          provenance: { createdFrom: "USER_APPROVAL" },
          reusable: true,
          reusableAs: ["FEATURE"],
          sensitivity: {
            containsPersonalData: false,
            containsConfidentialData: false,
            containsRawConversation: false,
            containsInternalIds: false,
            safeForReference: true,
          },
        },
      },
    });
    expect(mapped.reusableAs).toContain("FEATURE");
  });
});
