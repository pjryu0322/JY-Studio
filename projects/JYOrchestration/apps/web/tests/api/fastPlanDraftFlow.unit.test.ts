import { describe, expect, it } from "vitest";
import { createPlatformTrigger } from "@/lib/platform-orchestration/runResultFactory";
import { runFastPlanDraftFlow } from "@/lib/platform-orchestration/flows/fastPlanDraftFlow";
import { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import {
  FAST_PLAN_DRAFT_ACTION_CONFIRM,
  FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT,
  FAST_PLAN_DRAFT_ACTION_REGENERATE,
} from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";

const nowIso = "2026-05-24T12:00:00.000Z";
const slotDefinitions = buildDynamicServicePlanningSlotDefinitions({
  projectId: "p1",
  projectName: "회의록 서비스",
});

function sampleOrchestration(): RequirementsSingleChatOrchestrationStateV1 {
  const base: RequirementsSingleChatOrchestrationStateV1 = {
    version: 2,
    stageGroup: "service-planning",
    slotDefinitionsHash: "test",
    slots: {},
    baseSlotKeys: slotDefinitions.map((d) => d.slotKey),
  };
  for (const def of slotDefinitions) {
    if (def.slotKey.endsWith(".planning.servicePurpose")) {
      base.slots[def.slotKey] = {
        slotKey: def.slotKey,
        ownerAgent: def.ownerAgent,
        stageGroup: def.stageGroup,
        label: def.label,
        status: "candidate",
        value: "회의록을 자동으로 정리하는 서비스",
        updatedAt: nowIso,
      };
    } else {
      base.slots[def.slotKey] = {
        slotKey: def.slotKey,
        ownerAgent: def.ownerAgent,
        stageGroup: def.stageGroup,
        label: def.label,
        status: "empty",
        value: null,
        updatedAt: nowIso,
      };
    }
  }
  return base;
}

const sampleFlow = {
  version: 1 as const,
  steps: [
    { id: "s1", order: 1, title: "녹취 업로드", description: "" },
    { id: "s2", order: 2, title: "회의록 생성", description: "" },
  ],
  actors: [],
};

function baseInput() {
  const trigger = createPlatformTrigger({
    flowId: "fast_plan_draft",
    source: "cta",
    projectId: "p1",
    conversationScope: "project_single_chat",
    createdAt: nowIso,
  });
  return {
    trigger,
    projectName: "회의록 자동화",
    projectDescription: "녹취 파일을 회의록과 TODO로 정리",
    conversationMessages: [],
    serviceFlow: sampleFlow,
    orchestration: sampleOrchestration(),
    slotDefinitions,
    nowIso,
  };
}

describe("fastPlanDraftFlow", () => {
  it("creates platform run result for fast_plan_draft", () => {
    const result = runFastPlanDraftFlow(baseInput());

    expect(result.flowId).toBe("fast_plan_draft");
    expect(result.memberRuns.length).toBeGreaterThan(0);
    expect(result.memberDrafts.some((d) => d.role === "planner")).toBe(true);
    expect(result.userMessage).toContain("AI기획자");
  });

  it("creates planner analyst architect designer drafts when roles are available", () => {
    const result = runFastPlanDraftFlow(baseInput());

    expect(result.memberDrafts.map((d) => d.role)).toEqual(
      expect.arrayContaining(["planner", "analyst", "architect", "designer"]),
    );
  });

  it("skips designer draft when designer role is disabled", () => {
    const result = runFastPlanDraftFlow({
      ...baseInput(),
      projectAiTeam: {
        projectId: "p1",
        enabledRoles: ["planner", "analyst", "architect"],
        members: [],
      },
    });

    expect(result.memberRuns).toContainEqual(
      expect.objectContaining({
        role: "designer",
        status: "skipped",
      }),
    );
    expect(result.memberDrafts.some((d) => d.role === "designer")).toBe(false);
  });

  it("skips planner run when planner role is missing", () => {
    const result = runFastPlanDraftFlow({
      ...baseInput(),
      projectAiTeam: {
        projectId: "p1",
        enabledRoles: ["analyst", "architect", "designer"],
        members: [],
      },
    });

    expect(result.memberRuns).toContainEqual(
      expect.objectContaining({
        role: "planner",
        status: "skipped",
      }),
    );
    expect(result.nextActions.some((a) => a.enabled === false)).toBe(true);
  });

  it("returns next actions for generating fast plan artifact after draft", () => {
    const result = runFastPlanDraftFlow(baseInput());

    expect(result.nextActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: FAST_PLAN_DRAFT_ACTION_CONFIRM }),
        expect.objectContaining({ label: FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT }),
        expect.objectContaining({ label: FAST_PLAN_DRAFT_ACTION_REGENERATE }),
      ]),
    );
  });
});
