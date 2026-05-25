import { describe, expect, it } from "vitest";
import {
  LEGACY_QUICK_DESIGN_AREA_TITLES,
  mergePlannedArtifactsIntoState,
  planProjectArtifactsFromOrchestrationContext,
  orchestrateArtifactPlanning,
} from "@/lib/requirements/projectArtifactPlan";
import { PROJECT_ARTIFACT_LABELS } from "@/lib/requirements/projectArtifactTypes";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("projectArtifactPlan", () => {
  it("plans required standard types including prototype plan label", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const plan = planProjectArtifactsFromOrchestrationContext({
      orchestration,
      definitions,
      serviceFlow: null,
      featurePlanning: null,
      memberDrafts: [],
    });

    expect(plan.requiredTypes).toContain("summary");
    expect(plan.requiredTypes).toContain("fast_prototype_plan");
    expect(plan.orchestration.planned.length).toBeGreaterThan(0);
    const proto = plan.planned.find((p) => p.artifactType === "fast_prototype_plan");
    expect(proto?.title).toBe(PROJECT_ARTIFACT_LABELS["fast_prototype_plan"]);
    expect(proto?.title).not.toBe("빠른 프로토타입 기획안");
  });

  it("merge strips legacy Quick Design area artifacts", () => {
    const merged = mergePlannedArtifactsIntoState({
      priorArtifacts: [
        {
          id: "legacy-1",
          type: "summary",
          title: "서비스 정의 산출물",
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "old",
        },
        {
          id: "keep-1",
          type: "summary",
          title: PROJECT_ARTIFACT_LABELS.summary,
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "old summary",
        },
      ],
      priorDeliverables: [
        {
          id: "legacy-1",
          projectId: "p1",
          type: "full_plan",
          title: "분석 산출물",
          version: 1,
          content: "x",
          createdAt: nowIso,
        },
      ],
      newArtifacts: [
        {
          id: "new-1",
          type: "summary",
          title: PROJECT_ARTIFACT_LABELS.summary,
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "new summary",
        },
      ],
      projectId: "p1",
      replacedTypes: ["summary"],
    });

    const titles = merged.projectArtifacts.map((a) => a.title);
    for (const legacy of LEGACY_QUICK_DESIGN_AREA_TITLES) {
      expect(titles).not.toContain(legacy);
    }
    expect(titles).toContain(PROJECT_ARTIFACT_LABELS.summary);
    expect(merged.projectArtifacts.some((a) => a.id === "new-1")).toBe(true);
  });
});
