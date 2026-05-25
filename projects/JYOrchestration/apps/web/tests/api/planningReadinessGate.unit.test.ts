import { describe, expect, it } from "vitest";
import {
  evaluateImplementationStartReadiness,
  evaluatePlanningToGenerationReadiness,
  evaluateRequiredImplementationArtifacts,
} from "@/lib/requirements/planningReadinessGate";
import { PROJECT_ARTIFACT_LABELS } from "@/lib/requirements/projectArtifactTypes";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("planningReadinessGate", () => {
  it("blocks generation stage when required planning slots are not confirmed", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const readiness = evaluatePlanningToGenerationReadiness({ orchestration, definitions });

    expect(readiness.ready).toBe(false);
    expect(readiness.missingRequiredSlotKeys.length).toBeGreaterThan(0);
  });

  it("allows generation preparation after required slots are confirmed", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const base = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const slots = { ...base.slots };
    const suffixes = [
      ".planning.servicePurpose",
      ".planning.coreUsers",
      ".planning.problem",
      ".planning.expectedOutcome",
      ".flow.actorTypes",
      ".flow.serviceFlow",
      ".design.coreFeatures",
      ".design.requiredScreens",
    ];
    for (const suffix of suffixes) {
      const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
      if (!key || !slots[key]) continue;
      slots[key] = {
        ...slots[key],
        status: "confirmed",
        value: `${suffix} 확정 값`,
        updatedAt: nowIso,
      };
    }
    const orchestration = { ...base, slots };

    const readiness = evaluatePlanningToGenerationReadiness({ orchestration, definitions });
    expect(readiness.ready).toBe(true);
  });

  it("blocks implementation start when required artifacts are missing", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const base = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const slots = { ...base.slots };
    const suffixes = [
      ".planning.servicePurpose",
      ".planning.coreUsers",
      ".planning.problem",
      ".planning.expectedOutcome",
      ".flow.actorTypes",
      ".flow.serviceFlow",
      ".design.coreFeatures",
      ".design.requiredScreens",
    ];
    for (const suffix of suffixes) {
      const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
      if (!key || !slots[key]) continue;
      slots[key] = {
        ...slots[key],
        status: "confirmed",
        value: `${suffix} 확정`,
        updatedAt: nowIso,
      };
    }
    const orchestration = { ...base, slots };
    const readiness = evaluateImplementationStartReadiness({
      orchestration,
      definitions,
      projectArtifacts: [],
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toContain("필수 산출물이 아직 준비되지 않았습니다");
  });

  it("allows implementation start when slots and required artifacts exist", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const base = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const slots = { ...base.slots };
    const suffixes = [
      ".planning.servicePurpose",
      ".planning.coreUsers",
      ".planning.problem",
      ".planning.expectedOutcome",
      ".flow.actorTypes",
      ".flow.serviceFlow",
      ".design.coreFeatures",
      ".design.requiredScreens",
    ];
    for (const suffix of suffixes) {
      const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
      if (!key || !slots[key]) continue;
      slots[key] = {
        ...slots[key],
        status: "confirmed",
        value: `${suffix} 확정`,
        updatedAt: nowIso,
      };
    }
    const orchestration = { ...base, slots };
    const requiredTypes = ["summary", "fast_prototype_plan"] as const;
    const artifacts = requiredTypes.map((type, i) => ({
      id: `a-${i}`,
      type,
      title: PROJECT_ARTIFACT_LABELS[type],
      createdAt: nowIso,
      createdBy: "ai" as const,
      sourceStage: "IDEATION" as const,
      content: "# 본문\n\n" + "내용\n".repeat(40),
      orchestration: {
        reason: "test",
        required: true,
        confidence: 0.9,
        sourceRoles: ["AI기획자"],
        sourceSlotKeys: ["slot.k"],
        trace: [
          {
            artifactType: type,
            section: PROJECT_ARTIFACT_LABELS[type],
            sourceSlots: ["slot.k"],
            sourceMessages: [],
            sourceRoles: ["AI기획자"],
          },
        ],
        completenessScore: 0.9,
        hubReadinessLabel: "구현 가능",
        plannedAt: nowIso,
      },
    }));
    const readiness = evaluateImplementationStartReadiness({
      orchestration,
      definitions,
      projectArtifacts: artifacts,
      artifactOrchestrationV1: {
        plannedAt: nowIso,
        serviceProfile: "standard",
        requiredTypes: [...requiredTypes],
        planned: [],
        memberRoles: ["planner"],
        planningSummary: "test",
      },
    });
    expect(readiness.ready).toBe(true);
  });

  it("ignores legacy Quick Design area artifacts for artifact gate", () => {
    const onlyLegacy = [
      {
        id: "l1",
        type: "summary" as const,
        title: "분석 산출물",
        createdAt: nowIso,
        createdBy: "ai" as const,
        sourceStage: "IDEATION" as const,
        content: "x",
      },
    ];
    const gate = evaluateRequiredImplementationArtifacts({ projectArtifacts: onlyLegacy });
    expect(gate.ready).toBe(false);
    expect(gate.missingRequiredArtifactTypes.length).toBeGreaterThan(0);
  });
});
