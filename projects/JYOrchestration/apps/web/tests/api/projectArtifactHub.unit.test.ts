import { describe, expect, it } from "vitest";
import { buildProjectArtifactHubCatalog } from "@/lib/requirements/projectArtifactHub";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const now = "2026-05-19T00:00:00.000Z";

describe("projectArtifactHub", () => {
  it("buildProjectArtifactHubCatalog — projectArtifacts + deliverableAssets", () => {
    const state: RequirementsStateJson = {
      requirementsOrchestrationStageV1: "FEATURE_DETAIL",
      projectArtifacts: [
        {
          id: "art-1",
          type: "feature-spec",
          title: "기능 정의서",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "FEATURE_DETAIL",
          content: "# 기능",
        },
      ],
    };
    const catalog = buildProjectArtifactHubCatalog({
      state,
      projectArtifacts: state.projectArtifacts ?? [],
      deliverableAssets: [
        {
          id: "del-1",
          projectId: "p1",
          type: "full_plan",
          title: "통합 기획안",
          version: 1,
          content: "body",
          createdAt: now,
        },
      ],
    });
    expect(catalog).toHaveLength(2);
    expect(catalog.some((e) => e.kind === "project-artifact")).toBe(true);
    expect(catalog.some((e) => e.kind === "deliverable")).toBe(true);
  });
});
