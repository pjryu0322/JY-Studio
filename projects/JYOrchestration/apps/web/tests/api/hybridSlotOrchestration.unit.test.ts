import { describe, expect, it } from "vitest";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  singleChatOrchestrationConfirmedProgress,
  validateDynamicProposedSlots,
} from "@/lib/requirements/singleChatOrchestrationSlots";

describe("hybrid slot orchestration", () => {
  it("base progress ignores dynamic slots", () => {
    const baseDefs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "회의록 서비스",
      projectDescription: "회의 내용을 자동으로 정리하고 공유합니다.",
      projectType: null,
      servicePlanningAgentCatalogKeys: [],
      acceptedDynamicSlots: null,
    });
    const dyn = validateDynamicProposedSlots({
      nowIso: "2026-01-01T00:00:00.000Z",
      baseDefinitions: baseDefs,
      existingDynamicSlots: null,
      suggestedSlots: [
        {
          slotKey: "dyn_meetingApprovalFlow",
          title: "회의 승인 흐름",
          description: "회의록 승인/검수 프로세스",
          ownerAgent: "security",
          reason: "승인/검수 요구가 도메인에 중요",
          priority: "high",
          proposalConfidence: 0.8,
        },
      ],
    });
    expect(dyn.accepted[0]?.ownerAgent).toBe("security-reviewer");
    expect(dyn.accepted[0]?.externalProposedOwner).toBe("security");
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "회의록 서비스",
      projectDescription: "회의 내용을 자동으로 정리하고 공유합니다.",
      projectType: null,
      servicePlanningAgentCatalogKeys: [],
      acceptedDynamicSlots: dyn.accepted,
    });
    const state = initialOrchestrationStateFromDefinitions(defs, "2026-01-01T00:00:00.000Z");
    // dynamic slot exists
    expect(Object.keys(state.slots).some((k) => k.startsWith("dyn_"))).toBe(true);
    const progress = singleChatOrchestrationConfirmedProgress(state);
    // still base-only: total should not count dynamic
    expect(progress.total).toBe(baseDefs.length);
  });

  it("rejects collisions with base keys and invalid owner", () => {
    const baseDefs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "공공/SI",
      projectDescription: "행정 시스템 연동",
      projectType: null,
      servicePlanningAgentCatalogKeys: [],
      acceptedDynamicSlots: null,
    });
    const res = validateDynamicProposedSlots({
      nowIso: "2026-01-01T00:00:00.000Z",
      baseDefinitions: baseDefs,
      existingDynamicSlots: null,
      suggestedSlots: [
        {
          slotKey: baseDefs[0]!.slotKey, // collide
          title: "충돌 슬롯",
          description: "base key를 덮으려는 시도",
          ownerAgent: "security",
        },
        {
          slotKey: "dyn_legacyIntegration",
          title: "레거시 연동",
          description: "기존 시스템 연동 요구",
          ownerAgent: "cursor-developer", // forbidden
        } as any,
      ],
    });
    expect(res.accepted.length).toBe(0);
    expect(res.rejected.length).toBeGreaterThanOrEqual(2);
  });
});

