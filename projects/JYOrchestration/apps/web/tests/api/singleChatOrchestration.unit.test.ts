import { describe, expect, it } from "vitest";
import {
  buildDynamicServicePlanningSlotDefinitions,
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  mergeOrchestrationSlotPatches,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { plannerPreferredFromAgents, runSingleChatOrchestrationFallbackTurn } from "@/lib/requirements/singleChatOrchestrationOpenAI";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import type { SingleChatSelectedAgentWire } from "@/lib/requirements/singleChatAgentContext";

describe("singleChatOrchestration slots", () => {
  it("동적 슬롯에 planner·분석가·설계자 owner 가 분리된다", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "예약 MVP",
      projectDescription: "사내 회의실 예약",
      projectType: "web",
    });
    const planners = defs.filter((d) => d.ownerAgent === "planner");
    const analysts = defs.filter((d) => d.ownerAgent === "service-designer" || d.ownerAgent === "domain-expert");
    const designers = defs.filter((d) => d.ownerAgent === "spec-reviewer" || d.ownerAgent === "task-reviewer");
    expect(planners.length).toBeGreaterThan(0);
    expect(analysts.length).toBeGreaterThan(0);
    expect(designers.length).toBeGreaterThan(0);
    expect(defs.some((d) => d.slotKey.includes(".planning."))).toBe(true);
  });

  it("mergeOrchestrationSlotPatches 가 상태를 갱신한다", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "T",
      projectDescription: "",
      projectType: null,
    });
    const ts = "2026-05-07T00:00:00.000Z";
    const base = initialOrchestrationStateFromDefinitions(defs, ts);
    const key = defs.find((d) => d.ownerAgent === "planner")?.slotKey;
    expect(key).toBeTruthy();
    const next = mergeOrchestrationSlotPatches({
      base,
      patches: [{ slotKey: key!, status: "completed", value: "테스트 목적", confidence: 0.9 }],
      nowIso: ts,
    });
    expect(next.slots[key!]?.status).toBe("completed");
    expect(next.slots[key!]?.value).toContain("테스트");
  });

  it("hashSlotDefinitions 가 정의 변경 시 바뀐다", () => {
    const a = buildDynamicServicePlanningSlotDefinitions({ projectName: "A", projectDescription: "", projectType: null });
    const b = buildDynamicServicePlanningSlotDefinitions({ projectName: "B", projectDescription: "", projectType: null });
    expect(hashSlotDefinitions(a)).not.toBe(hashSlotDefinitions(b));
  });
});

describe("singleChatOrchestration agents & fallback", () => {
  it("plannerPreferredFromAgents", () => {
    const agents: SingleChatSelectedAgentWire[] = [
      {
        source: "project_member",
        displayName: "기획자",
        aiOrchestrationRole: "planner",
      },
    ];
    expect(plannerPreferredFromAgents(agents)).toBe(true);
    expect(plannerPreferredFromAgents([])).toBe(false);
  });

  it("관련 입력 시 service-designer 슬롯이 활성 역할일 때 갱신된다", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "Demo",
      projectDescription: "",
      projectType: null,
    });
    const ts = "2026-05-07T00:00:00.000Z";
    const base = initialOrchestrationStateFromDefinitions(defs, ts);
    const activeRoles = new Set(["planner", "service-designer"]);
    const out = runSingleChatOrchestrationFallbackTurn({
      userMessage: "관리자와 일반 사용자 화면이 달라요.",
      definitions: defs,
      baseState: base,
      activeRoles,
      nowIso: ts,
    });
    expect(out.meta.delegatedAgents).toContain("service-designer");
    expect(out.meta.routingDecision.length).toBeGreaterThan(0);
    expect(out.meta.updatedSlotKeys.length).toBeGreaterThan(0);
    expect(out.assistantMessage.length).toBeGreaterThan(0);
  });

  it("기능 언급 시 spec-reviewer 슬롯이 활성일 때 갱신될 수 있다", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "Demo",
      projectDescription: "",
      projectType: null,
    });
    const ts = "2026-05-07T00:00:00.000Z";
    const base = initialOrchestrationStateFromDefinitions(defs, ts);
    const activeRoles = new Set(["planner", "spec-reviewer"]);
    const out = runSingleChatOrchestrationFallbackTurn({
      userMessage: "예약 기능과 결제 화면이 필요합니다.",
      definitions: defs,
      baseState: base,
      activeRoles,
      nowIso: ts,
    });
    expect(out.meta.delegatedAgents).toContain("spec-reviewer");
  });

  it("fallback 시 promptTimeline 연계용 routingDecision 이 비어 있지 않다", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "Demo",
      projectDescription: "",
      projectType: null,
    });
    const ts = "2026-05-07T00:00:00.000Z";
    const base = initialOrchestrationStateFromDefinitions(defs, ts);
    const out = runSingleChatOrchestrationFallbackTurn({
      userMessage: "네.",
      definitions: defs,
      baseState: base,
      activeRoles: new Set(["planner"]),
      nowIso: ts,
    });
    expect(out.meta.routingDecision).toMatch(/^E:/);
  });
});

describe("singleChatOrchestration parse wire", () => {
  it("parseRequirementsSingleChatOrchestrationV1 라운드트립", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "Z",
      projectDescription: "z",
      projectType: null,
    });
    const ts = "2026-05-07T00:00:00.000Z";
    const init = initialOrchestrationStateFromDefinitions(defs, ts);
    const raw = JSON.parse(JSON.stringify(init)) as unknown;
    const parsed = parseRequirementsSingleChatOrchestrationV1(raw);
    expect(parsed?.version).toBe(1);
    expect(parsed?.slotDefinitionsHash).toBe(init.slotDefinitionsHash);
    expect(Object.keys(parsed?.slots ?? {}).length).toBe(Object.keys(init.slots).length);
  });
});
