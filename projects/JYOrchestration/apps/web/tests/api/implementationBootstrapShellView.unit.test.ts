import { describe, expect, it } from "vitest";
import { buildImplementationBootstrapShellView } from "@/lib/prototype/implementationOrchestrationSummary";
import { IMPLEMENTATION_ENTRY_READINESS_HEADLINE } from "@/lib/prototype/implementationWorkPlanDraft";

describe("buildImplementationBootstrapShellView", () => {
  it("returns seed-missing copy when no seed", () => {
    const view = buildImplementationBootstrapShellView({
      summaryInput: {
        envLoading: false,
        projectId: "p1",
        env: { gitRepoUrl: null, hasCursorToken: false },
        envOk: true,
        envSettingsHref: "/x",
        featureDraftTitles: [],
        projectArtifacts: [],
        artifactOrchestrationV1: null,
        designOk: true,
      },
      actionLabels: ["환경설정"],
    });
    expect(view.body).toContain("구현 Seed");
    expect(view.actionLabels).toEqual(["환경설정"]);
  });

  it("returns bootstrap message body when seed exists", () => {
    const view = buildImplementationBootstrapShellView({
      summaryInput: {
        envLoading: false,
        projectId: "p1",
        env: { gitRepoUrl: null, hasCursorToken: false },
        envOk: true,
        envSettingsHref: "/x",
        featureDraftTitles: [],
        projectArtifacts: [{ id: "a1", type: "screen", title: "화면", content: "c" }],
        artifactOrchestrationV1: null,
        designOk: true,
        implementationSeedV1: {
          version: "implementation_seed_v1",
          projectId: "p1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          source: "planning_slots_and_artifacts",
          lifecycleStatus: "confirmed",
          readiness: { ready: true, score: 1, missing: [], warnings: [] },
          processImplementationItems: [],
          screenImplementationItems: [],
          actorCapabilityMatrix: [],
          commonDetailFeatures: [],
          dataModelSeed: { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
          assumptions: [],
          gaps: [],
        },
        slotDefinitions: [],
      },
      actionLabels: ["구현 작업목록 생성"],
    });
    expect(view.body.length).toBeGreaterThan(IMPLEMENTATION_ENTRY_READINESS_HEADLINE.length - 1);
    expect(view.actionLabels).toContain("구현 작업목록 생성");
  });
});
