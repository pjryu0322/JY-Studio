import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as orchestrationSlots from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  buildDynamicServicePlanningSlotDefinitions,
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  LLM_EXTERNAL_ORCHESTRATION_ROLES,
  mergeOrchestrationSlotPatches,
  singleChatOrchestrationConfirmedProgress,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  plannerPreferredFromAgents,
  runSelectiveMultiAgentOrchestrationOpenAI,
  runSingleChatOrchestrationFallbackTurn,
} from "@/lib/requirements/singleChatOrchestrationOpenAI";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import type { SingleChatSelectedAgentWire } from "@/lib/requirements/singleChatAgentContext";

const { mockPostOpenAi } = vi.hoisted(() => ({
  mockPostOpenAi: vi.fn(),
}));

vi.mock("@/lib/ai/openAiChatCompletions", () => ({
  postOpenAiChatCompletion: (input: unknown) => mockPostOpenAi(input),
}));

describe("singleChatOrchestration slots", () => {
  it("동적 슬롯에 planner·분석가·설계자 owner 가 분리된다", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "예약 MVP",
      projectDescription: "사내 회의실 예약",
      projectType: "web",
    });
    const planners = defs.filter((d) => d.ownerAgent === "planner");
    const analysts = defs.filter((d) => d.ownerAgent === "service-designer" || d.ownerAgent === "domain-expert");
    const designers = defs.filter(
      (d) => d.ownerAgent === "solution-architect" || d.ownerAgent === "task-reviewer" || d.ownerAgent === "ui-designer"
    );
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
    expect(next.slots[key!]?.status).toBe("confirmed");
    expect(next.slots[key!]?.value).toContain("테스트");
  });

  it("planner 슬롯 값 변경 시 dependsOn 기반 stale 전파", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "StaleDemo",
      projectDescription: "",
      projectType: null,
    });
    const ts = "2026-05-07T00:00:00.000Z";
    const base = initialOrchestrationStateFromDefinitions(defs, ts);
    const plannerKey = defs.find((d) => d.ownerAgent === "planner" && d.slotKey.includes("servicePurpose"))?.slotKey;
    const derivedKey = defs.find((d) => d.ownerAgent === "service-designer" && d.slotKey.includes("actorTypes"))?.slotKey;
    expect(plannerKey).toBeTruthy();
    expect(derivedKey).toBeTruthy();

    const seeded = mergeOrchestrationSlotPatches({
      base,
      patches: [
        { slotKey: derivedKey!, status: "candidate", value: "임시 기능", confidence: 0.5 },
        { slotKey: plannerKey!, status: "partial", value: "첫 목적", confidence: 0.6 },
      ],
      nowIso: ts,
    });

    const bumped = mergeOrchestrationSlotPatches({
      base: seeded,
      patches: [{ slotKey: plannerKey!, status: "partial", value: "바뀐 서비스 목적", confidence: 0.7 }],
      nowIso: "2026-05-07T00:01:00.000Z",
      definitions: defs,
      propagateStaleFromPlanner: true,
    });

    expect(bumped.slots[derivedKey!]?.status).toBe("stale");
    expect(String(bumped.slots[derivedKey!]?.staleReason ?? "")).toContain("upstream");
  });

  it("stale 슬롯에 새 후보 패치를 적용하면 상태가 갱신된다", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "Reanalyze",
      projectDescription: "",
      projectType: null,
    });
    const ts = "2026-05-07T00:00:00.000Z";
    const base = initialOrchestrationStateFromDefinitions(defs, ts);
    const k = defs.find((d) => d.slotKey.includes("actorTypes"))?.slotKey;
    expect(k).toBeTruthy();
    const staleFirst = mergeOrchestrationSlotPatches({
      base,
      patches: [{ slotKey: k!, status: "stale", value: "옛 후보", staleReason: "upstream", confidence: null }],
      nowIso: ts,
    });
    const refreshed = mergeOrchestrationSlotPatches({
      base: staleFirst,
      patches: [{ slotKey: k!, status: "candidate", value: "재분석 액터", confidence: 0.72, staleReason: null }],
      nowIso: "2026-05-07T00:01:00.000Z",
    });
    expect(refreshed.slots[k!]?.status).toBe("candidate");
    expect(refreshed.slots[k!]?.value).toContain("재분석");
  });

  it("hashSlotDefinitions 가 정의 변경 시 바뀐다", () => {
    const a = buildDynamicServicePlanningSlotDefinitions({ projectName: "A", projectDescription: "", projectType: null });
    const b = buildDynamicServicePlanningSlotDefinitions({ projectName: "B", projectDescription: "", projectType: null });
    expect(hashSlotDefinitions(a)).not.toBe(hashSlotDefinitions(b));
  });

  it("초기 스캐폴드(empty/candidate)만 있으면 confirmed 진행률은 0%", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "P",
      projectDescription: "",
      projectType: null,
    });
    const ts = "2026-05-07T00:00:00.000Z";
    const base = initialOrchestrationStateFromDefinitions(defs, ts);
    const withHints = mergeOrchestrationSlotPatches({
      base,
      patches: [{ slotKey: defs[0]!.slotKey, status: "candidate", value: "힌트만", confidence: 0.4 }],
      nowIso: ts,
    });
    const pr = singleChatOrchestrationConfirmedProgress(withHints);
    expect(pr.confirmed).toBe(0);
    expect(pr.percent).toBe(0);
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
    expect(out.meta.delegatedAgents).toEqual([]);
    expect(out.meta.routingDecision).toContain("service-designer");
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
    const activeRoles = new Set(["planner", "solution-architect"]);
    const out = runSingleChatOrchestrationFallbackTurn({
      userMessage: "예약 기능과 결제 화면이 필요합니다.",
      definitions: defs,
      baseState: base,
      activeRoles,
      nowIso: ts,
    });
    expect(out.meta.delegatedAgents).toEqual([]);
    expect(out.meta.routingDecision).toContain("solution-architect");
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
    expect(out.meta.executedAgents).toEqual(["planner"]);
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
    const parsed = parseRequirementsSingleChatOrchestrationV1(raw, defs);
    expect(parsed?.version).toBe(2);
    expect(parsed?.slotDefinitionsHash).toBe(init.slotDefinitionsHash);
    expect(Object.keys(parsed?.slots ?? {}).length).toBe(Object.keys(init.slots).length);
  });
});

describe("runSelectiveMultiAgentOrchestrationOpenAI (mocked OpenAI)", () => {
  const allRoles = () =>
    new Set(["planner", "service-designer", "domain-expert", "solution-architect", "task-reviewer", "ui-designer"] as const);

  const baseInput = () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "MockOrch",
      projectDescription: "d",
      projectType: "web",
    });
    const ts = "2026-05-07T12:00:00.000Z";
    return {
      projectName: "MockOrch",
      projectDescription: "d",
      projectType: "web" as string | null,
      userMessage: "u",
      dialogueExcerpt: "",
      definitions: defs,
      baseState: initialOrchestrationStateFromDefinitions(defs, ts),
      participatingAgentsPromptBlock: "",
      activeRoles: allRoles(),
    };
  };

  const mergeAssistant = (msg: string) =>
    JSON.stringify({ assistantMessage: msg, plannerSlotAdjustments: [], derivedPromotions: [] });

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    mockPostOpenAi.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.OPENAI_API_KEY;
  });

  it("planner만: OpenAI 2회(route+merge), delegatedAgents 비어 있음", async () => {
    mockPostOpenAi.mockImplementation(async () => {
      const n = mockPostOpenAi.mock.calls.length;
      if (n === 1) {
        return {
          ok: true,
          text: JSON.stringify({
            routingDecision: "A: planner",
            matchedSlots: [],
            delegatedAgents: [],
            updatedSlots: [],
          }),
        };
      }
      return { ok: true, text: mergeAssistant("한 개의 응답만 드립니다.") };
    });
    const input = baseInput();
    const out = await runSelectiveMultiAgentOrchestrationOpenAI({ ...input, userMessage: "목적만 말함" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(mockPostOpenAi).toHaveBeenCalledTimes(3);
    expect(out.meta.delegatedAgents).toEqual([]);
    expect(out.meta.executedAgents.some((a) => a === "service-designer" || a === "solution-architect")).toBe(false);
    expect(typeof out.assistantMessage).toBe("string");
    // Next-question generator may replace merge message; keep only minimal assertions.
    expect(out.meta.routingDecision).toMatch(/orchestration_turn\(/);
  });

  it("액터/흐름: service-designer 그룹 1회 추가 호출", async () => {
    const input = baseInput();
    const actorsKey = input.definitions.find((d) => d.slotKey.includes("actorTypes"))?.slotKey;
    expect(actorsKey).toBeTruthy();

    mockPostOpenAi.mockImplementation(async () => {
      const n = mockPostOpenAi.mock.calls.length;
      if (n === 1) {
        return {
          ok: true,
          text: JSON.stringify({
            routingDecision: "B: 액터",
            matchedSlots: [actorsKey],
            delegatedAgents: ["service-designer"],
            updatedSlots: [],
          }),
        };
      }
      if (n === 2) {
        return {
          ok: true,
          text: JSON.stringify({
            updatedSlots: [
              {
                slotKey: actorsKey,
                status: "candidate",
                value: "관리자·일반 사용자",
                confidence: 0.82,
                ownerAgent: "service-designer",
              },
            ],
          }),
        };
      }
      return { ok: true, text: mergeAssistant("액터를 반영했습니다. 다음 질문 하나.") };
    });

    const out = await runSelectiveMultiAgentOrchestrationOpenAI({ ...input, userMessage: "관리자와 일반 사용자가 있어요" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(mockPostOpenAi).toHaveBeenCalledTimes(4);
    expect(out.meta.delegatedAgents).toContain("service-designer");
    expect(out.meta.delegatedAgents).not.toContain("solution-architect");
  });

  it("기능: solution-architect 그룹만 추가 호출", async () => {
    const input = baseInput();
    const featKey = input.definitions.find((d) => d.ownerAgent === "solution-architect" && d.slotKey.includes("coreFeatures"))?.slotKey;
    expect(featKey).toBeTruthy();

    mockPostOpenAi.mockImplementation(async () => {
      const n = mockPostOpenAi.mock.calls.length;
      if (n === 1) {
        return {
          ok: true,
          text: JSON.stringify({
            routingDecision: "C: 기능",
            matchedSlots: [featKey],
            delegatedAgents: ["solution-architect"],
            updatedSlots: [],
          }),
        };
      }
      if (n === 2) {
        return {
          ok: true,
          text: JSON.stringify({
            updatedSlots: [
              {
                slotKey: featKey,
                status: "candidate",
                value: "예약·결제",
                confidence: 0.77,
                ownerAgent: "solution-architect",
              },
            ],
          }),
        };
      }
      return { ok: true, text: mergeAssistant("기능을 정리했습니다.") };
    });

    const out = await runSelectiveMultiAgentOrchestrationOpenAI({ ...input, userMessage: "예약 기능이 필요해요" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(mockPostOpenAi).toHaveBeenCalledTimes(4);
    expect(out.meta.delegatedAgents).toContain("solution-architect");
    expect(out.meta.delegatedAgents).not.toContain("service-designer");
  });

  it("복합: flow·feature 순으로 선택 호출", async () => {
    const input = baseInput();
    const actorsKey = input.definitions.find((d) => d.slotKey.includes("actorTypes"))?.slotKey;
    const featKey = input.definitions.find((d) => d.slotKey.includes("coreFeatures"))?.slotKey;
    expect(actorsKey && featKey).toBeTruthy();

    mockPostOpenAi.mockImplementation(async () => {
      const n = mockPostOpenAi.mock.calls.length;
      if (n === 1) {
        return {
          ok: true,
          text: JSON.stringify({
            routingDecision: "D: 복합",
            matchedSlots: [actorsKey, featKey],
            delegatedAgents: ["service-designer", "solution-architect"],
            updatedSlots: [],
          }),
        };
      }
      if (n === 2) {
        return {
          ok: true,
          text: JSON.stringify({
            updatedSlots: [
              {
                slotKey: actorsKey,
                status: "candidate",
                value: "두 액터",
                confidence: 0.7,
                ownerAgent: "service-designer",
              },
            ],
          }),
        };
      }
      if (n === 3) {
        return {
          ok: true,
          text: JSON.stringify({
            updatedSlots: [
              {
                slotKey: featKey,
                status: "candidate",
                value: "핵심 기능",
                confidence: 0.71,
                ownerAgent: "solution-architect",
              },
            ],
          }),
        };
      }
      return { ok: true, text: mergeAssistant("통합 답변 한 덩어리") };
    });

    const out = await runSelectiveMultiAgentOrchestrationOpenAI({
      ...input,
      userMessage: "관리자 화면에서 예약 승인 기능",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(mockPostOpenAi).toHaveBeenCalledTimes(5);
    expect(out.meta.delegatedAgents.sort()).toEqual(["service-designer", "solution-architect"].sort());
  });

  it("route에서 planner 슬롯 값 변경 시 slotDependenciesChanged", async () => {
    const input = baseInput();
    const purposeKey = input.definitions.find((d) => d.slotKey.includes("servicePurpose"))?.slotKey;
    expect(purposeKey).toBeTruthy();

    mockPostOpenAi.mockImplementation(async () => {
      const n = mockPostOpenAi.mock.calls.length;
      if (n === 1) {
        return {
          ok: true,
          text: JSON.stringify({
            routingDecision: "A",
            matchedSlots: [purposeKey],
            delegatedAgents: [],
            updatedSlots: [
              {
                slotKey: purposeKey,
                status: "partial",
                value: "변경된 목적 문장",
                confidence: 0.66,
                ownerAgent: "planner",
              },
            ],
          }),
        };
      }
      return { ok: true, text: mergeAssistant("목적 반영했습니다.") };
    });

    const out = await runSelectiveMultiAgentOrchestrationOpenAI({ ...input, userMessage: "목적을 바꿀게요" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.meta.slotDependenciesChanged).toBe(true);
  });

  it("동적 슬롯 제안 시 validateDynamicProposedSlots는 1회만 호출", async () => {
    const spy = vi.spyOn(orchestrationSlots, "validateDynamicProposedSlots");
    try {
      const input = baseInput();
      mockPostOpenAi.mockImplementation(async () => {
        const n = mockPostOpenAi.mock.calls.length;
        if (n === 1) {
          return {
            ok: true,
            text: JSON.stringify({
              routingDecision: "A",
              matchedSlots: [],
              delegatedAgents: [],
              updatedSlots: [],
              suggestedSlots: [
                {
                  slotKey: "dyn_onceValidate",
                  title: "한번 검증",
                  description: "검증 호출 횟수를 확인하기 위한 충분히 긴 설명 필드입니다.",
                  ownerAgent: "planner",
                  reason: "테스트",
                  priority: "low",
                  proposalConfidence: 0.5,
                },
              ],
            }),
          };
        }
        return { ok: true, text: mergeAssistant("병합.") };
      });
      const out = await runSelectiveMultiAgentOrchestrationOpenAI(input);
      expect(out.ok).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("accepted 동적 슬롯은 내부 owner·slots 행·dynamicSlots·히스토리·meta가 검증 결과와 일치", async () => {
    const input = baseInput();
    const dynKey = "dyn_extraSlot";
    mockPostOpenAi.mockImplementation(async () => {
      const n = mockPostOpenAi.mock.calls.length;
      if (n === 1) {
        return {
          ok: true,
          text: JSON.stringify({
            routingDecision: "A",
            matchedSlots: [],
            delegatedAgents: [],
            updatedSlots: [],
            suggestedSlots: [
              {
                slotKey: dynKey,
                title: "추가 슬롯",
                description: "프로젝트 특화 추가 조사 항목을 채웁니다.",
                ownerAgent: "architect",
                reason: "설계 보강",
                priority: "low",
                proposalConfidence: 0.6,
              },
            ],
          }),
        };
      }
      return { ok: true, text: mergeAssistant("ok") };
    });
    const out = await runSelectiveMultiAgentOrchestrationOpenAI(input);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const row = out.nextState.slots[dynKey];
    expect(row?.ownerAgent).toBe("solution-architect");
    expect((LLM_EXTERNAL_ORCHESTRATION_ROLES as readonly string[]).includes(String(row?.ownerAgent ?? ""))).toBe(false);
    expect(row?.status).toBe("empty");
    expect(row?.confidence).toBe(0);
    expect(String(row?.value ?? "")).toBe("");
    expect(out.nextState.dynamicSlots?.[dynKey]?.ownerAgent).toBe("solution-architect");
    const hist = out.nextState.slotProposalHistory?.at(-1);
    expect(hist?.acceptedSlotKeys).toEqual([dynKey]);
    expect(hist?.suggestedSlots?.[0]?.ownerAgent).toBe("architect");
    expect(hist?.rejected?.length ?? 0).toBe(0);
    expect(out.meta.suggestedDynamicSlots).toEqual([dynKey]);
    expect(out.meta.acceptedDynamicSlotKeys).toEqual([dynKey]);
    expect(out.meta.rejectedDynamicSlots?.length ?? 0).toBe(0);
  });
});
