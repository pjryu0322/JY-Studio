import { describe, expect, it } from "vitest";
import {
  buildArtifactHubExportSections,
  resolveArtifactHubEntryMarkdown,
} from "@/lib/requirements/artifactHubExport";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import { PROJECT_ARTIFACT_HUB_GENERATE_ORDER, PROJECT_ARTIFACT_LABELS } from "@/lib/requirements/projectArtifactTypes";

const now = "2026-05-19T12:00:00.000Z";

describe("artifactHubExport", () => {
  it("resolves markdown from project artifact by asset id", () => {
    const entry: ProjectArtifactHubEntry = {
      id: "artifact-a1",
      kind: "project-artifact",
      artifactType: "summary",
      title: "서비스 정의 산출물",
      sourceStage: "IDEATION",
      createdAt: now,
      assetId: "a1",
    };
    const md = resolveArtifactHubEntryMarkdown({
      entry,
      projectArtifacts: [
        {
          id: "a1",
          type: "summary",
          title: "서비스 정의 산출물",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 본문",
        },
      ],
    });
    expect(md).toBe("# 본문");
  });

  it("builds export sections only for entries with content", () => {
    const entries: ProjectArtifactHubEntry[] = [
      {
        id: "artifact-a1",
        kind: "project-artifact",
        artifactType: "summary",
        title: "A",
        sourceStage: "IDEATION",
        createdAt: now,
        assetId: "a1",
      },
      {
        id: "artifact-missing",
        kind: "project-artifact",
        artifactType: "feature-spec",
        title: "B",
        sourceStage: "IDEATION",
        createdAt: now,
        assetId: "missing",
      },
    ];
    const sections = buildArtifactHubExportSections({
      entries,
      projectArtifacts: [
        {
          id: "a1",
          type: "summary",
          title: "A",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "body",
        },
      ],
    });
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("A");
  });
});

describe("projectArtifactTypes hub menu", () => {
  it("excludes markdown and pdf export from hub generate list", () => {
    expect(PROJECT_ARTIFACT_HUB_GENERATE_ORDER).not.toContain("markdown-export");
    expect(PROJECT_ARTIFACT_HUB_GENERATE_ORDER).not.toContain("pdf-export");
    expect(PROJECT_ARTIFACT_LABELS["fast_prototype_plan"]).toBe("프로토타입 기획안");
  });
});
