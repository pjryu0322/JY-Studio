import { describe, expect, it } from "vitest";
import { buildCreateWorkPlanFromChatOperationalResult } from "@/lib/prototype/implementationCreateWorkPlanFromChat";
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

const userMsg = newRequirementsMessage({
  role: "user",
  speakerType: "USER",
  speakerId: "me",
  speakerName: "나",
  messageType: "STATEMENT",
  content: "구현 작업안 초안 생성해줘",
});

describe("buildCreateWorkPlanFromChatOperationalResult", () => {
  it("returns apply_conversation with user and draft AI messages when ready", () => {
    const { orchestration, definitions, seed } = seedReadyState();
    const result = buildCreateWorkPlanFromChatOperationalResult({
      userMsg,
      requirementsStateJson: {
        singleChatOrchestrationV1: orchestration,
        implementationSeedV1: seed,
        prototypeExecutionSingleChatV1: { messages: [] },
      },
      projectId: "p1",
      projectArtifacts: planningArtifacts,
      orchestration,
      slotDefinitions: definitions,
      implementationSeedV1: seed,
      envOk: true,
      designOk: true,
    });

    expect(result).toMatchObject({ kind: "apply_conversation" });
    if (typeof result === "object" && result.kind === "apply_conversation") {
      expect(result.messages.some((m) => m.role === "user" && m.content.includes("초안"))).toBe(true);
      expect(result.messages.some((m) => m.role === "ai")).toBe(true);
    }
  });
});
