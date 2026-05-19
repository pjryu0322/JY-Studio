import { describe, expect, it } from "vitest";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  singleChatOrchestrationWeightedProgress,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { extractServiceFlowStructuralCapabilities } from "@/lib/requirements/serviceFlowOrchestrationSemantic";
import {
  buildServiceFlowApplySyncUserMessage,
  syncServiceFlowToOrchestrationSlots,
} from "@/lib/requirements/serviceFlowOrchestrationSync";

const now = "2026-05-19T12:00:00.000Z";

function sampleFlow(decision: string): RequirementsServiceFlowV1 {
  return {
    createdAt: now,
    updatedAt: now,
    lastProposalDecision: decision,
    actors: [
      { id: "a1", name: "편집자", kind: "human", description: "" },
      { id: "a2", name: "검토자", kind: "human", description: "" },
      { id: "a3", name: "요약 생성기", kind: "system", description: "" },
    ],
    steps: [
      {
        id: "s1",
        title: "녹취 업로드",
        purpose: "",
        order: 1,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s2",
        title: "검토 요청",
        purpose: "",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s3",
        title: "최종 확정",
        purpose: "",
        order: 3,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ],
  };
}

describe("serviceFlowOrchestrationSync bridge", () => {
  it("APPLY — partial 슬롯 증가 + 가중 진행도 상승", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "회의록",
      projectDescription: "녹취 요약",
      projectType: null,
    });
    const emptyOrch = initialOrchestrationStateFromDefinitions(defs, now);
    const sync = syncServiceFlowToOrchestrationSlots({
      flow: sampleFlow("APPLY"),
      definitions: defs,
      orchestration: emptyOrch,
      nowIso: now,
    });
    expect(sync).not.toBeNull();
    expect(sync!.slotSyncMode).toBe("service_flow_apply");
    expect(sync!.slotSyncCount).toBeGreaterThanOrEqual(2);
    expect(sync!.progressAfter.percent).toBeGreaterThan(sync!.progressBefore.percent);

    const actorKey = defs.find((d) => d.slotKey.includes(".flow.actorTypes"))!.slotKey;
    expect(sync!.state.slots[actorKey]?.status).toBe("partial");
    expect(sync!.state.slots[actorKey]?.derivedFrom).toBe("service-flow-sync");
  });

  it("ALTERNATIVE만 있으면 동기화하지 않음", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "P",
      projectDescription: "",
      projectType: null,
    });
    const sync = syncServiceFlowToOrchestrationSlots({
      flow: sampleFlow("ALTERNATIVE"),
      definitions: defs,
      orchestration: initialOrchestrationStateFromDefinitions(defs, now),
    });
    expect(sync).toBeNull();
  });

  it("confirmed 슬롯은 APPLY로 덮어쓰지 않음", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "P",
      projectDescription: "",
      projectType: null,
    });
    const base = initialOrchestrationStateFromDefinitions(defs, now);
    const actorKey = defs.find((d) => d.slotKey.includes(".flow.actorTypes"))!.slotKey;
    base.slots[actorKey] = {
      ...base.slots[actorKey],
      status: "confirmed",
      value: "기존 확정 값",
      derivedFrom: "planner",
    };
    const sync = syncServiceFlowToOrchestrationSlots({
      flow: sampleFlow("APPLY"),
      definitions: defs,
      orchestration: base,
    });
    expect(sync?.state.slots[actorKey]?.status).toBe("confirmed");
    expect(sync?.state.slots[actorKey]?.value).toBe("기존 확정 값");
  });

  it("buildServiceFlowApplySyncUserMessage — 동기화 항목 나열", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "P",
      projectDescription: "",
      projectType: null,
    });
    const sync = syncServiceFlowToOrchestrationSlots({
      flow: sampleFlow("APPLY"),
      definitions: defs,
      orchestration: initialOrchestrationStateFromDefinitions(defs, now),
    })!;
    const msg = buildServiceFlowApplySyncUserMessage({
      flow: sampleFlow("APPLY"),
      sync,
    });
    expect(msg).toContain("동기화된 항목");
    expect(msg).toContain("partial");
  });

  it("extractServiceFlowStructuralCapabilities — 협업·승인 신호", () => {
    const caps = extractServiceFlowStructuralCapabilities(sampleFlow("APPLY"));
    expect(caps.has("workflow.collaboration")).toBe(true);
    expect(caps.has("workflow.approval")).toBe(true);
    expect(caps.has("actors.multi_human")).toBe(true);
  });
});

describe("singleChatOrchestrationWeightedProgress", () => {
  it("confirmed/partial/candidate 가중 합", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "P",
      projectDescription: "",
      projectType: null,
    });
    const state = initialOrchestrationStateFromDefinitions(defs, now);
    const keys = Object.keys(state.slots).slice(0, 10);
    state.slots[keys[0]] = { ...state.slots[keys[0]], status: "confirmed" };
    state.slots[keys[1]] = { ...state.slots[keys[1]], status: "confirmed" };
    state.slots[keys[2]] = { ...state.slots[keys[2]], status: "partial" };
    state.slots[keys[3]] = { ...state.slots[keys[3]], status: "partial" };
    state.slots[keys[4]] = { ...state.slots[keys[4]], status: "candidate" };
    const w = singleChatOrchestrationWeightedProgress(state);
    expect(w.weightedScore).toBeGreaterThanOrEqual(2 + 2 * 0.5 + 0.25);
    expect(w.percent).toBeGreaterThan(0);
  });
});
