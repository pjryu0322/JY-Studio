import { describe, expect, it } from "vitest";
import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import {
  buildMaterializedReferenceContextFromSnapshot,
  parseMaterializedReferenceContextV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import { formatReferencePromptContextSectionText } from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";

const safeSnapshot = (): KnowledgeGraphRevisionSnapshot => ({
  purpose: "REFERENCE_CANDIDATE",
  nodes: [
    {
      entityKey: "internal-entity-key",
      nodeType: "Actor",
      title: "고객",
      summary: "주문 담당",
      reference: {
        lifecycle: "USER_APPROVED",
        reusable: true,
        reusableAs: ["ACTOR"],
        safeForReference: true,
      },
    },
    {
      entityKey: "bad",
      nodeType: "Actor",
      title: "sk-live-api-key-token",
      summary: null,
      reference: {
        lifecycle: "USER_APPROVED",
        reusable: true,
        reusableAs: ["ACTOR"],
        safeForReference: true,
      },
    },
    {
      entityKey: "nr",
      nodeType: "Feature",
      title: "결제",
      summary: null,
      reference: {
        lifecycle: "USER_APPROVED",
        reusable: false,
        reusableAs: ["FEATURE"],
        safeForReference: true,
      },
    },
    {
      entityKey: "flow",
      nodeType: "ServiceFlow",
      title: "관리자 검토",
      summary: null,
      reference: {
        lifecycle: "USER_APPROVED",
        reusable: true,
        reusableAs: ["SERVICE_FLOW"],
        safeForReference: true,
      },
    },
  ],
  edges: [],
});

describe("buildMaterializedReferenceContextFromSnapshot", () => {
  it("materializes only safe reusable nodes without internal ids in nodes", () => {
    const ctx = buildMaterializedReferenceContextFromSnapshot({
      sourceProjectTitle: "주문 서비스",
      snapshotTitle: "승인본",
      snapshotPurpose: "REFERENCE_CANDIDATE",
      sourceSnapshotId: "snap-audit-only",
      graphSnapshot: safeSnapshot(),
    });
    expect(ctx.nodes.length).toBe(2);
    expect(ctx.summary.graphReusableNodeCount).toBe(ctx.nodes.length);
    expect(ctx.summary.actorCount).toBe(1);
    expect(ctx.summary.serviceFlowCount).toBe(1);
    expect(JSON.stringify(ctx.nodes)).not.toContain("entityKey");
    expect(JSON.stringify(ctx.nodes)).not.toContain("internal-entity-key");
    const prompt = formatReferencePromptContextSectionText({
      summarySections: ctx.sections,
      selectedNodes: [],
    });
    expect(prompt).not.toContain("snap-audit-only");
    expect(ctx.source.sourceSnapshotId).toBe("snap-audit-only");
  });

  it("parseMaterializedReferenceContextV1 normalizes policy and caps nodes", () => {
    const built = buildMaterializedReferenceContextFromSnapshot({
      sourceProjectTitle: "P",
      snapshotTitle: "S",
      snapshotPurpose: "REFERENCE_PACKAGE",
      graphSnapshot: safeSnapshot(),
    });
    const roundtrip = parseMaterializedReferenceContextV1(built);
    expect(roundtrip?.policy.usage).toBe("REFERENCE_ONLY");
    expect(roundtrip?.version).toBe(1);
  });

  it("materialized context is independent from later snapshot mutations", () => {
    const snapshot = safeSnapshot();
    const ctx = buildMaterializedReferenceContextFromSnapshot({
      sourceProjectTitle: "A",
      snapshotTitle: "Snap",
      snapshotPurpose: "REFERENCE_CANDIDATE",
      graphSnapshot: snapshot,
    });
    const actorTitleBefore = ctx.nodes[0]?.title;
    snapshot.nodes[0]!.title = "변경된 액터";
    snapshot.nodes.push({
      entityKey: "new",
      nodeType: "Actor",
      title: "추가 액터",
      summary: null,
      reference: {
        lifecycle: "USER_APPROVED",
        reusable: true,
        reusableAs: ["ACTOR"],
        safeForReference: true,
      },
    });
    expect(ctx.nodes[0]?.title).toBe(actorTitleBefore);
    expect(ctx.nodes.length).toBe(2);
  });
});
