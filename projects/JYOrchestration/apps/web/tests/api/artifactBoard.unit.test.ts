import { describe, expect, it } from "vitest";
import {
  IMPLEMENTATION_REQUIRED_ARTIFACT_CATALOG,
  PLANNING_REQUIRED_ARTIFACT_CATALOG,
  allArtifactBoardCatalogItems,
} from "@/lib/artifacts/artifactBoardCatalog";
import {
  buildArtifactBoardItems,
  calculateArtifactBoardTabCounts,
  formatArtifactBoardTabCountLabel,
} from "@/lib/artifacts/buildArtifactBoardItems";
import { isArtifactContentMeaningful } from "@/lib/artifacts/artifactBoardStatus";
import { groupArtifactBoardItemsForDisplay, buildArtifactHubView } from "@/lib/prototype/artifactHubView";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const now = "2026-05-19T00:00:00.000Z";

describe("artifactBoard catalog", () => {
  it("defines planning and implementation artifact board catalog items", () => {
    expect(PLANNING_REQUIRED_ARTIFACT_CATALOG.length).toBe(5);
    expect(IMPLEMENTATION_REQUIRED_ARTIFACT_CATALOG.length).toBeGreaterThanOrEqual(5);
    expect(allArtifactBoardCatalogItems().some((c) => c.stage === "planning")).toBe(true);
    expect(allArtifactBoardCatalogItems().some((c) => c.stage === "implementation")).toBe(true);
  });
});

describe("buildArtifactBoardItems", () => {
  it("marks catalog item as created when matching artifact exists with meaningful content", () => {
    const state: RequirementsStateJson = {
      projectArtifacts: [
        {
          id: "a1",
          type: "summary",
          title: "프로젝트 요약서",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 프로젝트 요약\n\n본문이 충분히 있습니다.",
        },
      ],
    };
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: state.projectArtifacts ?? [],
      requirementsStateJson: state,
      selectedStage: "planning",
    });
    const summary = items.find((i) => i.catalogId === "planning-summary");
    expect(summary?.status).toBe("created");
  });

  it("marks implementation artifacts as waiting when prerequisites are missing", () => {
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: [],
      requirementsStateJson: {},
      selectedStage: "implementation",
    });
    const workPlan = items.find((i) => i.catalogId === "impl-work-plan");
    expect(workPlan?.status).toBe("waiting");
    expect(workPlan?.generationCondition).toMatch(/기획/);
  });

  it("marks implementation work plan as generatable when implementation seed exists", () => {
    const state: RequirementsStateJson = {
      projectArtifacts: [
        {
          id: "fp",
          type: "fast_prototype_plan",
          title: "프로토타입 기획안",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 기획안\n\n충분한 내용",
        },
      ],
      implementationSeedV1: {
        version: "implementation_seed_v1",
        projectId: "p1",
        createdAt: now,
        updatedAt: now,
        lifecycleStatus: "confirmed",
        readiness: { ready: true, score: 0.9, missing: [] },
        gaps: [],
        assumptions: [],
        processImplementationItems: [{ processName: "p1" }],
        screenImplementationItems: [{ screenName: "s1" }],
        actorCapabilityMatrix: [{ actor: "user", capabilities: ["read"] }],
        commonDetailFeatures: [],
        dataModelSeed: { entities: ["e1"], mockDataNotes: [] },
      },
    };
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: state.projectArtifacts ?? [],
      requirementsStateJson: state,
      selectedStage: "implementation",
    });
    const workPlan = items.find((i) => i.catalogId === "impl-work-plan");
    expect(workPlan?.status).toBe("generatable");
  });

  it("calculates artifact board tab counts as created over total targets", () => {
    const state: RequirementsStateJson = {
      projectArtifacts: [
        {
          id: "a1",
          type: "summary",
          title: "요약",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 요약서 본문",
        },
        {
          id: "a2",
          type: "feature-spec",
          title: "기능",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 기능 정의",
        },
      ],
    };
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: state.projectArtifacts ?? [],
      requirementsStateJson: state,
      selectedStage: "all",
    });
    const counts = calculateArtifactBoardTabCounts(items);
    expect(formatArtifactBoardTabCountLabel(counts.planning)).toMatch(/^\d+\/\d+$/);
    expect(counts.planning.total).toBe(6);
    expect(counts.planning.created).toBeGreaterThanOrEqual(1);
    expect(counts.implementation.total).toBeGreaterThanOrEqual(5);
    expect(counts.implementation.created).toBe(0);
    expect(counts.all.created).toBeGreaterThanOrEqual(1);
    expect(counts.all.total).toBeGreaterThanOrEqual(10);
  });

  it("does not show planning artifacts as cards in implementation tab", () => {
    const view = buildArtifactHubView({
      mode: "implementation",
      state: {
        projectArtifacts: [
          {
            id: "a1",
            type: "summary",
            title: "요약",
            createdAt: now,
            createdBy: "ai",
            sourceStage: "IDEATION",
            content: "# 요약",
          },
        ],
      },
      projectId: "p1",
    });
    const implSection = groupArtifactBoardItemsForDisplay(view, "implementation");
    const implItems = implSection.sections.flatMap((s) => s.items);
    expect(implItems.every((i) => i.stage === "implementation" || i.stage === "review")).toBe(true);
    expect(implItems.some((i) => i.catalogId.startsWith("planning-"))).toBe(false);
  });

  it("hides download actions for missing artifacts", () => {
    const items = buildArtifactBoardItems({
      projectId: "p1",
      projectArtifacts: [],
      requirementsStateJson: {},
      selectedStage: "planning",
    });
    const summary = items.find((i) => i.catalogId === "planning-summary");
    expect(summary?.actions).not.toContain("download_doc");
    expect(summary?.actions).not.toContain("download_pdf");
    expect(summary?.actions).toContain("generate");
  });
});
