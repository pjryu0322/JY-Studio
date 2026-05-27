import { describe, expect, it, vi } from "vitest";
import {
  resolveImplementationOperationalSend,
  type ImplementationOperationalSendHandlers,
} from "@/lib/prototype/implementationOperationalSend";
import {
  buildImplementationSeedFromPlanning,
  IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS,
  IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP,
} from "@/lib/requirements/implementationSeed";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

const nowIso = "2026-05-25T10:00:00.000Z";

function seedReadyState() {
  const definitions = buildDynamicServicePlanningSlotDefinitions({
    projectName: "demo",
    projectDescription: "demo",
  });
  const base = initialOrchestrationStateFromDefinitions(definitions, nowIso);
  const slots = { ...base.slots };
  for (const gapKey of IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS) {
    const suffix = IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey];
    const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
    if (!key || !slots[key]) continue;
    slots[key] = {
      ...slots[key],
      status: "confirmed",
      value: "confirmed slot value for seed gate",
      updatedAt: nowIso,
    };
  }
  const orchestration = { ...base, slots };
  const seed = buildImplementationSeedFromPlanning({
    projectId: "p1",
    orchestration,
    definitions,
    lifecycleStatus: "confirmed",
    nowIso,
  });
  return { orchestration, definitions, seed };
}

const planningArtifacts: ProjectArtifact[] = [
  {
    id: "p1",
    type: "fast_prototype_plan",
    title: "프로토타입 기획안",
    content: "# plan",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "ai",
    sourceStage: "feature-planning",
  },
];

const handlers: ImplementationOperationalSendHandlers = {
  appendNotice: vi.fn(),
  showToast: vi.fn(),
  focusChatInput: vi.fn(),
  startWorkPlanGeneration: vi.fn(),
  openPlannerPrompt: vi.fn(),
  openEnvSettings: vi.fn(),
  openArtifactHub: vi.fn(),
  buildStatusQueryResult: () => null,
  persistRequirementPatch: vi.fn(),
};

describe("resolveImplementationOperationalSend timeline", () => {
  it("includes intent routed and action executed for 구현 작업안 생성해줘", async () => {
    const { orchestration, definitions, seed } = seedReadyState();
    const userMsg = newRequirementsMessage({
      role: "user",
      speakerType: "USER",
      speakerId: "me",
      speakerName: "나",
      messageType: "STATEMENT",
      content: "구현 작업안 생성해줘",
    });
    const requirementsStateJson = {
      singleChatOrchestrationV1: orchestration,
      implementationSeedV1: seed,
      prototypeExecutionSingleChatV1: { messages: [] },
    };

    const result = await resolveImplementationOperationalSend(
      {
        text: "구현 작업안 생성해줘",
        userMsg,
        isDraftGenerationComplete: false,
        isRunningState: false,
        envOk: true,
        designOk: true,
        requirementsStateJson,
        projectId: "p1",
        projectArtifacts: planningArtifacts,
        orchestration,
        slotDefinitions: definitions,
        implementationSeedV1: seed,
        promptTimeline: [],
        routeParams: {
          text: "구현 작업안 생성해줘",
          visibleActionLabels: [],
          envOk: true,
          templatePlanningReady: true,
          implementationSeedReady: true,
          hasWorkUnits: false,
          isPlannerRunning: false,
          plannerCreatePending: false,
          protoBusy: false,
          projectName: "demo",
          projectDescription: "demo",
          enableLlmClassifier: false,
        },
      },
      handlers,
    );

    expect(result).toMatchObject({ kind: "apply_conversation" });
    if (typeof result !== "object" || result.kind !== "apply_conversation") return;

    const actions = result.timelineEntries?.map((e) => e.action) ?? [];
    expect(actions).toEqual(["implementation_intent_routed", "implementation_action_executed"]);
    expect(result.timelineEntries?.[1]?.responseText).toContain("actionId=CREATE_WORK_PLAN");
  });
});
