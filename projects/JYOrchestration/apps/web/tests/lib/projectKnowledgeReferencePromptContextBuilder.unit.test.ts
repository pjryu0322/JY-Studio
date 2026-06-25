import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    projectKnowledgeGraphRevision: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionQuery", () => ({
  loadKnowledgeGraphRevision: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { loadKnowledgeGraphRevision } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionQuery";
import { buildReferencePromptContextForProjectTurn } from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";

describe("buildReferencePromptContextForProjectTurn", () => {
  beforeEach(() => {
    vi.mocked(prisma.project.findUnique).mockReset();
    vi.mocked(prisma.projectKnowledgeGraphRevision.findUnique).mockReset();
    vi.mocked(loadKnowledgeGraphRevision).mockReset();
  });

  it("returns hasReference=false when selection is absent", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      requirementsStateJson: {},
    } as never);
    const section = await buildReferencePromptContextForProjectTurn({
      projectId: "p1",
      userMessage: "고객",
    });
    expect(section.hasReference).toBe(false);
    expect(section.promptText).toBe("");
  });

  it("builds prompt with relevant nodes for user message", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      requirementsStateJson: {
        referenceSelectionV1: {
          referenceSnapshotIds: ["snap-1"],
          selectedAt: "2026-06-01T00:00:00.000Z",
          source: "USER_SELECTED",
        },
      },
    } as never);
    vi.mocked(prisma.projectKnowledgeGraphRevision.findUnique).mockResolvedValue({
      id: "snap-1",
      projectId: "src",
    } as never);
    vi.mocked(loadKnowledgeGraphRevision).mockResolvedValue({
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
    } as never);

    const section = await buildReferencePromptContextForProjectTurn({
      projectId: "p1",
      userMessage: "고객과 관리자 검토",
      projectName: "신규",
      projectDescription: "서비스",
    });

    expect(section.hasReference).toBe(true);
    expect(section.promptText).toContain("[참조 프로젝트 컨텍스트]");
    expect(section.promptText).not.toContain("snap-1");
    expect(section.promptText).not.toContain("e1");
    expect(section.diagnostics.selectedNodeCount).toBeGreaterThan(0);
  });
});
