import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import {
  isPlannerStableEnough,
  mergeOrchestrationSlotPatches,
  slotBucketsByStatus,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type { SingleChatSelectedAgentWire } from "@/lib/requirements/singleChatAgentContext";
import { DESIGN_OWNERS, FLOW_OWNERS, SECURITY_OWNERS } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";
import { runPlannerRouteTurnOpenAI } from "@/lib/requirements/singleChatOrchestrationOpenAI.plannerRoute";
import { runSpecialistGroupTurnOpenAI } from "@/lib/requirements/singleChatOrchestrationOpenAI.specialist";
import { runPlannerMergeTurnOpenAI } from "@/lib/requirements/singleChatOrchestrationOpenAI.plannerMerge";
import { validateDynamicProposedSlots } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { SingleChatDynamicSlotProposalHistoryV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import { safeJsonParse } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";

export type SingleChatOrchestrationTurnMeta = Readonly<{
  routingDecision: string;
  matchedSlots: readonly string[];
  updatedSlotKeys: readonly string[];
  /** 실제 LLM이 실행된 specialist 역할만 */
  delegatedAgents: readonly string[];
  orchestratorAgent: string;
  executedAgents: readonly string[];
  staleSlots: readonly string[];
  confirmedSlots: readonly string[];
  candidateSlots: readonly string[];
  slotDependenciesChanged: boolean;
}>;

export type SingleChatOrchestrationTurnOk = Readonly<{
  ok: true;
  assistantMessage: string;
  nextState: RequirementsSingleChatOrchestrationStateV1;
  meta: SingleChatOrchestrationTurnMeta;
  promptText: string;
  model: string;
  provider: string;
  calledAt: string;
}>;

export type SingleChatOrchestrationTurnResult = SingleChatOrchestrationTurnOk | Readonly<{ ok: false; code: string; message: string }>;

export function activeOrchestrationRolesFromAgents(agents: readonly SingleChatSelectedAgentWire[]): Set<string> {
  const s = new Set<string>();
  for (const a of agents) {
    const r = String(a.aiOrchestrationRole ?? "").trim().toLowerCase();
    if (r) s.add(r);
  }
  return s;
}

export function plannerPreferredFromAgents(agents: readonly SingleChatSelectedAgentWire[]): boolean {
  return [...agents].some((a) => String(a.aiOrchestrationRole ?? "").trim().toLowerCase() === "planner");
}

export async function runHybridSlotProposalBootstrapOpenAI(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly projectType?: string | null;
  readonly participatingAgentsPromptBlock: string;
  readonly baseSlotCatalogJson: string;
}): Promise<
  Readonly<
    | { ok: true; suggestedSlots: Array<{ slotKey: string; title: string; description: string; ownerAgent: string; reason?: string | null; priority?: "high" | "medium" | "low" | null; proposalConfidence?: number | null }>; promptText: string; model: string; provider: string; calledAt: string }
    | { ok: false; code: string; message: string }
  >
> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  const model = resolveOpenAiModelFromEnv();
  const calledAt = new Date().toISOString();
  const agentInsert = input.participatingAgentsPromptBlock?.trim() ? `\n${input.participatingAgentsPromptBlock.trim()}\n` : "";

  const system = `${workspaceAiMemberSystemPrefix("ideation")}${agentInsert}
당신은 SingleChat의 "Hybrid Slot Orchestration" 슬롯 설계자입니다.
역할: Stable Base Schema는 유지하고, 프로젝트 특성에 필요한 추가 슬롯만 제안합니다.

규칙:
- base 슬롯을 제거/수정/이름변경 제안 금지.
- 완전 자유 생성 금지: slotKey는 반드시 "dyn_" prefix 사용.
- 도메인/서비스 특성에 직접 연관된 슬롯만 0~6개 제안.
- ownerAgent는 다음 중 하나: planner | analyst | architect | designer | reviewer | security
- title <= 40자, description <= 140자.
- reason은 한 줄.
- priority: high|medium|low.

출력(JSON 1개, 마크다운 금지):
{
  "suggestedSlots": [
    {
      "slotKey": "dyn_meetingApprovalFlow",
      "title": "회의 승인 흐름",
      "description": "회의록 승인/검수 프로세스",
      "ownerAgent": "reviewer",
      "reason": "승인/검수 요구가 핵심 리스크",
      "priority": "high",
      "proposalConfidence": 0.8
    }
  ]
}`;

  const user = `[프로젝트]
name: ${input.projectName}
type: ${String(input.projectType ?? "").trim() || "—"}
description: ${input.projectDescription.trim().slice(0, 900)}

[base slot catalog]
${input.baseSlotCatalogJson.slice(0, 12000)}

위 정보를 기반으로 suggestedSlots만 출력하라.`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.22,
    responseFormatJsonObject: true,
  });
  if (!res.ok) return { ok: false, code: res.code, message: res.message.slice(0, 400) };
  const text = res.text?.trim() ?? "";
  const parsed = safeJsonParse(text) as Record<string, unknown> | null;
  const raw = parsed && Array.isArray(parsed.suggestedSlots) ? (parsed.suggestedSlots as unknown[]) : [];
  const suggestedSlots = raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const r = x as Record<string, unknown>;
      const slotKey = String(r.slotKey ?? "").trim();
      const title = String(r.title ?? "").trim();
      const description = String(r.description ?? "").trim();
      const ownerAgent = String(r.ownerAgent ?? "").trim();
      if (!slotKey || !title || !description || !ownerAgent) return null;
      const priorityRaw = String(r.priority ?? "").trim().toLowerCase();
      const priority =
        priorityRaw === "high" || priorityRaw === "medium" || priorityRaw === "low" ? (priorityRaw as any) : null;
      const proposalConfidence =
        r.proposalConfidence !== null && r.proposalConfidence !== undefined && Number.isFinite(Number(r.proposalConfidence))
          ? Math.min(1, Math.max(0, Number(r.proposalConfidence)))
          : null;
      const reason = typeof r.reason === "string" ? r.reason.slice(0, 200) : r.reason === null ? null : null;
      return { slotKey, title, description, ownerAgent, reason, priority, proposalConfidence };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return {
    ok: true,
    suggestedSlots,
    promptText: `[slot-proposal-bootstrap]\n[system]\n${system}\n\n[user]\n${user}\n\n[raw]\n${text}`,
    model,
    provider: "openai",
    calledAt,
  };
}

export async function runSelectiveMultiAgentOrchestrationOpenAI(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly projectType?: string | null;
  readonly userMessage: string;
  readonly dialogueExcerpt: string;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly baseState: RequirementsSingleChatOrchestrationStateV1;
  readonly participatingAgentsPromptBlock: string;
  readonly activeRoles: Set<string>;
  readonly mentionTargetsSummary?: string;
  readonly senderSummary?: string;
  readonly priorScreenHandoff?: string;
}): Promise<SingleChatOrchestrationTurnResult> {
  const calledAt = new Date().toISOString();
  const promptChunks: string[] = [];
  const executedAgents: string[] = ["planner-route"];

  // Definitions can grow during the turn (hybrid dynamic slots).
  let definitions = [...input.definitions];

  const route = await runPlannerRouteTurnOpenAI(input);
  if (!route.ok) return route;

  promptChunks.push(route.promptText);

  // Hybrid: validate + accept suggested dynamic slots (auto-accept for now).
  let acceptedDynamicSlotKeys: string[] = [];
  let rejectedDynamicSlots: any[] = [];
  if (route.suggestedSlots?.length) {
    const v = validateDynamicProposedSlots({
      nowIso: calledAt,
      baseDefinitions: definitions.filter((d) => !String(d.slotKey).startsWith("dyn_")),
      existingDynamicSlots: input.baseState.dynamicSlots ?? null,
      suggestedSlots: route.suggestedSlots as any,
    });
    acceptedDynamicSlotKeys = v.accepted.map((x) => x.slotKey);
    rejectedDynamicSlots = v.rejected;

    if (v.accepted.length) {
      // Persist definitions into state.dynamicSlots and extend slot definitions for runtime merge.
      const dynMap: Record<string, any> = { ...(input.baseState.dynamicSlots ?? {}) };
      for (const d of v.accepted) dynMap[d.slotKey] = d;

      // Extend runtime definitions so the rest of the turn can target them.
      const dynDefs = v.accepted.map((d) => ({
        slotKey: d.slotKey,
        label: d.title,
        ownerAgent: d.ownerAgent, // normalized later when building defs from state; keep raw here
        stageGroup: (input.definitions[0]?.stageGroup ?? "service-planning"),
        hints: d.description,
        dependsOn: [],
      }));
      definitions.push(...(dynDefs as any));
    }
  }

  let state = mergeOrchestrationSlotPatches({
    base: input.baseState,
    patches: route.patches,
    nowIso: calledAt,
    definitions,
    propagateStaleFromPlanner: true,
  });

  if (acceptedDynamicSlotKeys.length || rejectedDynamicSlots.length) {
    const dyn = { ...(state.dynamicSlots ?? {}) } as any;
    for (const k of acceptedDynamicSlotKeys) {
      const found = route.suggestedSlots?.find((s) => String((s as any).slotKey ?? "").trim().startsWith(k)) ?? null;
      // state.dynamicSlots expects validated defs; validateDynamicProposedSlots already normalized.
    }
    // Use validated list rather than reusing raw suggested.
    if (route.suggestedSlots?.length) {
      const v = validateDynamicProposedSlots({
        nowIso: calledAt,
        baseDefinitions: definitions.filter((d) => !String(d.slotKey).startsWith("dyn_")),
        existingDynamicSlots: state.dynamicSlots ?? null,
        suggestedSlots: route.suggestedSlots as any,
      });
      for (const d of v.accepted) dyn[d.slotKey] = d;
      const prevRejected = Array.isArray(state.rejectedDynamicSlots) ? [...state.rejectedDynamicSlots] : [];
      const nextRejected = [...prevRejected, ...v.rejected];
      const prevHist = Array.isArray(state.slotProposalHistory) ? [...state.slotProposalHistory] : [];
      const histEntry: SingleChatDynamicSlotProposalHistoryV1 = {
        proposedAt: calledAt,
        suggestedSlots: route.suggestedSlots as any,
        acceptedSlotKeys: v.accepted.map((d) => d.slotKey),
        rejected: v.rejected,
      };
      state = {
        ...state,
        dynamicSlots: dyn,
        rejectedDynamicSlots: nextRejected,
        slotProposalHistory: [...prevHist, histEntry],
      };
    }
  }

  const slotDepsChanged = route.patches.some((p) => {
    const prev = input.baseState.slots[p.slotKey];
    return prev && prev.ownerAgent === "planner" && String(prev.value ?? "") !== String(p.value ?? "");
  });

  const delegated = route.delegatedAgents;
  const needFlow = delegated.some((d) => FLOW_OWNERS.has(d) && input.activeRoles.has(d));
  const needDesign = delegated.some((d) => DESIGN_OWNERS.has(d) && input.activeRoles.has(d));
  const needSecurity = delegated.some((d) => SECURITY_OWNERS.has(d) && input.activeRoles.has(d));

  const executedSpecialists: string[] = [];
  let specialistDigest = "";

  if (needFlow) {
    const sp = await runSpecialistGroupTurnOpenAI({
      groupLabel: "flow-analyst",
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      userMessage: input.userMessage,
      dialogueExcerpt: input.dialogueExcerpt,
      definitions: input.definitions,
      state,
      activeRoles: input.activeRoles,
      allowedOwners: FLOW_OWNERS,
    });
    promptChunks.push(sp.promptText);
    if (sp.ok && sp.patches.length) {
      state = mergeOrchestrationSlotPatches({
        base: state,
        patches: sp.patches,
        nowIso: new Date().toISOString(),
      });
      specialistDigest += `[흐름분석]\n${JSON.stringify(sp.patches).slice(0, 2000)}\n`;
    }
    if (sp.ok) executedSpecialists.push(...sp.executedRoles.filter((r) => FLOW_OWNERS.has(r)));
  }

  if (needDesign) {
    const sp = await runSpecialistGroupTurnOpenAI({
      groupLabel: "feature-designer",
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      userMessage: input.userMessage,
      dialogueExcerpt: input.dialogueExcerpt,
      definitions: input.definitions,
      state,
      activeRoles: input.activeRoles,
      allowedOwners: DESIGN_OWNERS,
    });
    promptChunks.push(sp.promptText);
    if (sp.ok && sp.patches.length) {
      state = mergeOrchestrationSlotPatches({
        base: state,
        patches: sp.patches,
        nowIso: new Date().toISOString(),
      });
      specialistDigest += `[기능설계]\n${JSON.stringify(sp.patches).slice(0, 2000)}\n`;
    }
    if (sp.ok) executedSpecialists.push(...sp.executedRoles.filter((r) => DESIGN_OWNERS.has(r)));
  }

  if (needSecurity) {
    const sp = await runSpecialistGroupTurnOpenAI({
      groupLabel: "security-reviewer",
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      userMessage: input.userMessage,
      dialogueExcerpt: input.dialogueExcerpt,
      definitions: input.definitions,
      state,
      activeRoles: input.activeRoles,
      allowedOwners: SECURITY_OWNERS,
    });
    promptChunks.push(sp.promptText);
    if (sp.ok && sp.patches.length) {
      state = mergeOrchestrationSlotPatches({
        base: state,
        patches: sp.patches,
        nowIso: new Date().toISOString(),
      });
      specialistDigest += `[보안]\n${JSON.stringify(sp.patches).slice(0, 2000)}\n`;
    }
    if (sp.ok) executedSpecialists.push(...sp.executedRoles.filter((r) => SECURITY_OWNERS.has(r)));
  }

  const uniqSpecialists = [...new Set(executedSpecialists)];
  executedAgents.push(...uniqSpecialists);

  const plannerStable = isPlannerStableEnough(state, input.definitions);
  const merge = await runPlannerMergeTurnOpenAI({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    userMessage: input.userMessage,
    dialogueExcerpt: input.dialogueExcerpt,
    state,
    specialistDigest,
    plannerStable,
    participatingAgentsPromptBlock: input.participatingAgentsPromptBlock,
    definitions,
  });

  if (!merge.ok) {
    return { ok: false, code: merge.code, message: merge.message };
  }

  promptChunks.push(merge.promptText);
  executedAgents.push("planner-merge");

  const mergeIso = new Date().toISOString();
  state = mergeOrchestrationSlotPatches({
    base: state,
    patches: merge.patches,
    nowIso: mergeIso,
    definitions,
    propagateStaleFromPlanner: false,
  });

  const buckets = slotBucketsByStatus(state);
  const allUpdated = [
    ...route.patches.map((p) => p.slotKey),
    ...merge.patches.map((p) => p.slotKey),
  ];

  const meta: SingleChatOrchestrationTurnMeta = {
    routingDecision: route.routingDecision,
    matchedSlots: route.matchedSlots,
    updatedSlotKeys: [...new Set(allUpdated)],
    delegatedAgents: uniqSpecialists,
    orchestratorAgent: "planner",
    executedAgents: [...new Set(executedAgents)],
    staleSlots: buckets.stale,
    confirmedSlots: buckets.confirmed,
    candidateSlots: buckets.candidate,
    slotDependenciesChanged: slotDepsChanged,
  };

  return {
    ok: true,
    assistantMessage: merge.assistantMessage,
    nextState: {
      ...state,
      lastOrchestratorAgent: "planner",
      lastDelegatedAgents: uniqSpecialists,
      lastRoutingDecision: route.routingDecision,
    },
    meta,
    promptText: promptChunks.join("\n\n---\n\n"),
    model: merge.model,
    provider: "openai",
    calledAt: mergeIso,
  };
}

/**
 * 휴리스틱 — OpenAI 실패 시. 멀티 Agent 호출 생략, planner-only.
 */
export function runSingleChatOrchestrationFallbackTurn(input: {
  readonly userMessage: string;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly baseState: RequirementsSingleChatOrchestrationStateV1;
  readonly activeRoles: Set<string>;
  readonly nowIso: string;
}): SingleChatOrchestrationTurnOk {
  const um = input.userMessage.trim();
  const patches: SlotPatchInput[] = [];
  const matched: string[] = [];
  const delegatedIntent = new Set<string>();

  const bump = (
    slotKey: string,
    owner: string,
    fragment: string,
    conf: number,
    delegateRole: string,
    status: "partial" | "candidate"
  ): void => {
    if (!input.activeRoles.has(delegateRole)) return;
    patches.push({
      slotKey,
      status,
      value: fragment,
      confidence: conf,
      ownerAgent: owner,
      derivedFrom: status === "candidate" ? "fallback:specialist" : "fallback:planner",
    });
    matched.push(slotKey);
    if (status === "candidate") delegatedIntent.add(delegateRole);
  };

  const lower = um.toLowerCase();
  const defByOwner = (role: string) => input.definitions.filter((d) => d.ownerAgent === role);

  if (/관리자|admin|운영자/.test(um)) {
    const d = defByOwner("service-designer").find((x) => x.slotKey.includes("actorTypes"));
    if (d) bump(d.slotKey, d.ownerAgent, "관리자 액터 언급", 0.55, "service-designer", "candidate");
  }
  if (/일반\s*사용자|고객|이용자|user/.test(lower)) {
    const d = defByOwner("service-designer").find((x) => x.slotKey.includes("actorTypes"));
    if (d && !matched.includes(d.slotKey)) bump(d.slotKey, d.ownerAgent, "일반 사용자 액터 언급", 0.55, "service-designer", "candidate");
  }
  if (/예약|booking|reservation/.test(lower)) {
    const flow = defByOwner("service-designer").find((x) => x.slotKey.includes("serviceFlow"));
    if (flow) bump(flow.slotKey, flow.ownerAgent, "예약 관련 흐름 언급", 0.5, "service-designer", "candidate");
    const feat = defByOwner("spec-reviewer").find((x) => x.slotKey.includes("coreFeatures"));
    if (feat) bump(feat.slotKey, feat.ownerAgent, "예약 기능 언급", 0.5, "spec-reviewer", "candidate");
  }
  if (/화면|UI|페이지/.test(um)) {
    const d = defByOwner("spec-reviewer").find((x) => x.slotKey.includes("requiredScreens"));
    if (d) bump(d.slotKey, d.ownerAgent, "화면/UI 언급", 0.45, "spec-reviewer", "candidate");
  }
  if (/우선|priority|mvp|필수\s*기능/.test(lower)) {
    const d = defByOwner("task-reviewer").find((x) => x.slotKey.includes("featurePriority"));
    if (d) bump(d.slotKey, d.ownerAgent, "우선순위/MVP 언급", 0.45, "task-reviewer", "candidate");
  }
  if (/목적|만들고\s*싶|서비스\s*아이디어|무엇을/.test(um)) {
    const d = defByOwner("planner").find((x) => x.slotKey.includes("servicePurpose"));
    if (d) bump(d.slotKey, d.ownerAgent, um.slice(0, 400), 0.5, "planner", "partial");
  }

  let nextState = mergeOrchestrationSlotPatches({
    base: input.baseState,
    patches,
    nowIso: input.nowIso,
    definitions: input.definitions,
    propagateStaleFromPlanner: true,
  });

  const delegatedList = [...delegatedIntent]
    .map((d) => String(d ?? "").trim().toLowerCase())
    .filter((d) => d && d !== "planner" && input.activeRoles.has(d));

  const routingDecision =
    patches.length === 0
      ? "E: 슬롯 미충족 — 후속 질문 필요 (fallback, planner-only)"
      : delegatedList.length > 1
        ? `D: 다중 후보 (fallback, specialist 미호출) — ${delegatedList.join(",")}`
        : delegatedList.length === 1
          ? `B/C: 후보 슬롯 (fallback) — ${delegatedList[0]}`
          : "A: planner 영역 (fallback)";

  const msg =
    patches.length === 0
      ? "말씀해 주신 내용을 바탕으로 조금만 더 구체화하고 싶습니다. 가장 먼저 해결하려는 사용자의 문제를 한 문장으로 알려주실 수 있을까요?"
      : `좋습니다. 현재 답변을 반영해 필요한 정보를 정리했습니다.\n\n한 가지만 더 알려주세요. 지금 단계에서 가장 불확실한 부분은 무엇인가요?`;

  const buckets = slotBucketsByStatus(nextState);

  const meta: SingleChatOrchestrationTurnMeta = {
    routingDecision,
    matchedSlots: matched,
    updatedSlotKeys: patches.map((p) => p.slotKey),
    delegatedAgents: [],
    orchestratorAgent: "planner",
    executedAgents: ["planner"],
    staleSlots: buckets.stale,
    confirmedSlots: buckets.confirmed,
    candidateSlots: buckets.candidate,
    slotDependenciesChanged: patches.some((p) => input.baseState.slots[p.slotKey]?.ownerAgent === "planner"),
  };

  nextState = {
    ...nextState,
    lastOrchestratorAgent: "planner",
    lastDelegatedAgents: [],
    lastRoutingDecision: routingDecision,
  };

  return {
    ok: true,
    assistantMessage: msg,
    nextState,
    meta,
    promptText: "[orchestration:fallback_heuristic_planner_only]",
    model: "fallback",
    provider: "fallback",
    calledAt: input.nowIso,
  };
}
