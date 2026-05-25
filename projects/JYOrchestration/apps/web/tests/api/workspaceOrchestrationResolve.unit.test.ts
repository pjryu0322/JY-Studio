import { describe, expect, it } from "vitest";
import { resolveWorkspaceSingleChatOrchestration } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";

const hash = "defs-hash-1";

function orchWithCandidateSlots(): RequirementsSingleChatOrchestrationStateV1 {
  return {
    version: 2,
    stageGroup: "service-planning",
    slotDefinitionsHash: hash,
    baseSlotKeys: ["p.planning.servicePurpose", "p.flow.actorTypes"],
    slots: {
      "p.planning.servicePurpose": {
        slotKey: "p.planning.servicePurpose",
        ownerAgent: "ai-planner",
        stageGroup: "service-planning",
        label: "서비스 목적",
        status: "candidate",
        value: "테스트",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      "p.flow.actorTypes": {
        slotKey: "p.flow.actorTypes",
        ownerAgent: "ai-analyst",
        stageGroup: "service-planning",
        label: "액터",
        status: "candidate",
        value: "이용자",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    },
  };
}

describe("resolveWorkspaceSingleChatOrchestration", () => {
  it("prefers local null orchestration over persisted state after conversation reset", () => {
    const resolved = resolveWorkspaceSingleChatOrchestration({
      localState: { singleChatOrchestrationV1: null },
      persistedOrchestration: orchWithCandidateSlots(),
      slotDefinitionsHash: hash,
    });
    expect(resolved).toBeNull();
  });

  it("uses persisted orchestration when local state has no override key", () => {
    const persisted = orchWithCandidateSlots();
    const resolved = resolveWorkspaceSingleChatOrchestration({
      localState: {},
      persistedOrchestration: persisted,
      slotDefinitionsHash: hash,
    });
    expect(resolved).toBe(persisted);
  });
});
