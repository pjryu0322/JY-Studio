import { describe, expect, it } from "vitest";
import {
  buildProjectArtifactHubCatalog,
  countCompletedArtifactHubEntries,
} from "@/lib/requirements/projectArtifactHub";
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
    expect(countCompletedArtifactHubEntries(catalog)).toBe(2);
  });

  it("dedupes projectArtifacts and deliverableAssets that share the same asset id", () => {
    const state: RequirementsStateJson = {
      requirementsOrchestrationStageV1: "IDEATION",
      projectArtifacts: [
        {
          id: "qd-1",
          type: "summary",
          title: "프로젝트 요약서",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 요약",
        },
      ],
    };
    const catalog = buildProjectArtifactHubCatalog({
      state,
      projectArtifacts: state.projectArtifacts ?? [],
      deliverableAssets: [
        {
          id: "qd-1",
          projectId: "p1",
          type: "full_plan",
          title: "프로젝트 요약서",
          version: 1,
          content: "# 요약",
          createdAt: now,
        },
      ],
    });
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.kind).toBe("project-artifact");
    expect(catalog[0]?.title).toBe("프로젝트 요약서");
    expect(countCompletedArtifactHubEntries(catalog)).toBe(1);
  });
});
