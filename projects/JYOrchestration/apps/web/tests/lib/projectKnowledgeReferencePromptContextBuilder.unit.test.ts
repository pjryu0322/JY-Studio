import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    projectKnowledgeGraphRevision: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  buildReferencePromptContextForProjectTurn,
  buildReferencePromptContextSectionFromMaterialized,
} from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";
import { buildMaterializedReferenceContextFromSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";

const materialized = buildMaterializedReferenceContextFromSnapshot({
  sourceProjectTitle: "주문",
  snapshotTitle: "참조본",
  snapshotPurpose: "REFERENCE_CANDIDATE",
  sourceSnapshotId: "snap-hidden",
  graphSnapshot: {
    purpose: "REFERENCE_CANDIDATE",
    nodes: [
      {
        entityKey: "e1",
        nodeType: "Actor",
        title: "고객",
        summary: null,
        reference: {
          lifecycle: "USER_APPROVED",
          reusable: true,
          reusableAs: ["ACTOR"],
          safeForReference: true,
        },
      },
      {
        entityKey: "e2",
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
  },
});

describe("buildReferencePromptContextForProjectTurn (materialized)", () => {
  beforeEach(() => {
    vi.mocked(prisma.project.findUnique).mockReset();
    vi.mocked(prisma.projectKnowledgeGraphRevision.findUnique).mockReset();
  });

  it("uses materialized state without revision lookup", async () => {
    const section = await buildReferencePromptContextForProjectTurn({
      projectId: "p1",
      userMessage: "고객과 관리자 검토",
      requirementsStateJson: {
        referenceSelectionV1: {
          referenceSnapshotIds: ["snap-hidden"],
          selectedAt: "2026-06-01T00:00:00.000Z",
          source: "USER_SELECTED",
        },
        materializedReferenceContextV1: materialized,
      },
    });
    expect(section.hasReference).toBe(true);
    expect(section.referenceContextSource).toBe("MATERIALIZED");
    expect(section.promptText).toContain("[참조 프로젝트 컨텍스트]");
    expect(section.promptText).not.toContain("snap-hidden");
    expect(section.promptText).not.toContain("e1");
    expect(prisma.projectKnowledgeGraphRevision.findUnique).not.toHaveBeenCalled();
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });

  it("returns LEGACY_MISSING when selection exists without materialized context", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      requirementsStateJson: {
        referenceSelectionV1: {
          referenceSnapshotIds: ["old"],
          selectedAt: "2026-06-01T00:00:00.000Z",
          source: "USER_SELECTED",
        },
      },
    } as never);
    const section = await buildReferencePromptContextForProjectTurn({
      projectId: "p1",
      userMessage: "test",
    });
    expect(section.hasReference).toBe(false);
    expect(section.referenceContextSource).toBe("LEGACY_MISSING");
    expect(section.promptText).toBe("");
    expect(section.diagnostics.selectionReason).toBe("materialized_context_missing");
    expect(prisma.projectKnowledgeGraphRevision.findUnique).not.toHaveBeenCalled();
  });

  it("selects relevant materialized nodes for user message", () => {
    const section = buildReferencePromptContextSectionFromMaterialized({
      materialized,
      userMessage: "고객 승인 전 관리자 검토",
    });
    expect(section.selectedNodes.length).toBeGreaterThan(0);
    expect(section.referenceContextSource).toBe("MATERIALIZED");
  });
});
