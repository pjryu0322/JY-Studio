import { describe, expect, it } from "vitest";
import {
  attachOrchestrationToArtifact,
  detectArtifactServiceProfile,
  orchestrateArtifactPlanning,
} from "@/lib/requirements/artifactOrchestration";
import { generateArtifactsFromPlan, planProjectArtifactsFromOrchestrationContext } from "@/lib/requirements/projectArtifactPlan";
import { evaluateRequiredImplementationArtifacts } from "@/lib/requirements/planningReadinessGate";
import { buildProjectArtifactHubCatalog } from "@/lib/requirements/projectArtifactHub";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("artifactOrchestration", () => {
  it("plans artifacts from orchestration context", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const result = orchestrateArtifactPlanning({
      orchestration,
      definitions,
      serviceFlow: null,
      featurePlanning: null,
      memberDrafts: [{ role: "planner", content: "요약", agentId: "a", runId: "r", flowId: "fast_plan_draft" }],
    });
    expect(result.planned.length).toBeGreaterThan(0);
    expect(result.requiredTypes.length).toBeGreaterThan(0);
    expect(result.planned.every((p) => p.reason.length > 4)).toBe(true);
    expect(result.planned.every((p) => p.sourceRoles.length > 0)).toBe(true);
  });

  it("stores artifact trace information on generation", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "정적 UI",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const plan = planProjectArtifactsFromOrchestrationContext({
      orchestration,
      definitions,
      serviceFlow: null,
      featurePlanning: null,
      nowIso,
    });
    const required = plan.planned.filter((p) => p.priority === "required").slice(0, 1);
    const artifacts = generateArtifactsFromPlan({
      plan: required,
      orchestration: plan.orchestration,
      base: {
        projectName: "정적 UI",
        sourceStage: "IDEATION",
        nowIso,
        createdBy: "ai",
      },
    });
    expect(artifacts[0]?.orchestration?.trace?.length).toBeGreaterThan(0);
    expect(artifacts[0]?.orchestration?.reason).toBeTruthy();
  });

  it("does not require API spec for static prototype profile", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "랜딩",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const profile = detectArtifactServiceProfile({
      orchestration,
      definitions,
      serviceFlow: null,
      featurePlanning: null,
      memberDrafts: [],
    });
    expect(profile).toBe("static_prototype");
    const result = orchestrateArtifactPlanning({
      orchestration,
      definitions,
      serviceFlow: null,
      featurePlanning: null,
    });
    expect(result.requiredTypes).not.toContain("api-spec");
  });

  it("shows orchestration metadata in artifact hub catalog", () => {
    const artifact = attachOrchestrationToArtifact({
      artifact: {
        id: "a1",
        type: "summary",
        title: "프로젝트 요약서",
        createdAt: nowIso,
        createdBy: "ai",
        sourceStage: "IDEATION",
        content: "# 요약\n\n".repeat(20),
      },
      planRow: {
        type: "summary",
        title: "프로젝트 요약서",
        required: true,
        reason: "AI기획자: 확정 슬롯 통합",
        sourceRoles: ["planner"],
        sourceSlotKeys: ["slot.a"],
        confidence: 0.9,
      },
      serviceProfile: "standard",
      nowIso,
    });
    const catalog = buildProjectArtifactHubCatalog({
      state: { requirementsOrchestrationStageV1: "IDEATION" },
      projectArtifacts: [artifact],
    });
    expect(catalog[0]?.hubReason).toContain("AI기획자");
    expect(catalog[0]?.hubSourceRoles).toContain("AI기획자");
    expect(catalog[0]?.hubReadinessLabel).toBeTruthy();
  });

  it("evaluateRequiredImplementationArtifacts uses dynamic required types", () => {
    const gate = evaluateRequiredImplementationArtifacts({
      requiredTypes: ["summary", "fast_prototype_plan"],
      projectArtifacts: [
        {
          id: "1",
          type: "summary",
          title: "프로젝트 요약서",
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# x\n\n" + "line\n".repeat(30),
          orchestration: {
            reason: "test",
            required: true,
            confidence: 0.9,
            sourceRoles: ["AI기획자"],
            sourceSlotKeys: ["k1"],
            trace: [
              {
                artifactType: "summary",
                section: "프로젝트 요약서",
                sourceSlots: ["k1"],
                sourceMessages: [],
                sourceRoles: ["AI기획자"],
              },
            ],
            completenessScore: 0.9,
            plannedAt: nowIso,
          },
        },
      ],
    });
    expect(gate.missingRequiredArtifactTypes).toContain("fast_prototype_plan");
  });
});
