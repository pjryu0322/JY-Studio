import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatDynamicSlotDefinitionV1,
  SingleChatDynamicSlotProposalHistoryV1,
  SingleChatDynamicSlotValidationRejectionV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import {
  cloneDynamicSlotProposalsFromPlannerRoute,
  computeSlotExpansionPhaseFromState,
  ensureDynamicSlotRowsInState,
  isPlannerStableEnough,
  mergeOrchestrationSlotPatches,
  SINGLE_CHAT_SERVICE_PLANNING_GROUP,
  slotBucketsByStatus,
  validateDynamicProposedSlots,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type { SingleChatSelectedAgentWire } from "@/lib/requirements/singleChatAgentContext";
import { DESIGN_OWNERS, FLOW_OWNERS, SECURITY_OWNERS } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";
import { runPlannerRouteTurnOpenAI } from "@/lib/requirements/singleChatOrchestrationOpenAI.plannerRoute";
import { runSpecialistGroupTurnOpenAI } from "@/lib/requirements/singleChatOrchestrationOpenAI.specialist";
import { runPlannerMergeTurnOpenAI } from "@/lib/requirements/singleChatOrchestrationOpenAI.plannerMerge";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import { safeJsonParse } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";

export type SingleChatOrchestrationTurnMeta = Readonly<{
  routingDecision: string;
  matchedSlots: readonly string[];
  updatedSlotKeys: readonly string[];
  updatedSlotCount: number;
  /** 실제 LLM이 실행된 specialist 역할만 */
  delegatedAgents: readonly string[];
  orchestratorAgent: string;
  /** 다음 질문을 생성한 ownerAgent(표시용; planner 독점 방지 추적) */
  nextQuestionOwnerAgent?: string | null;
  /** 오케스트레이션 단계(UX/추적용) */
  currentPhase?: 1 | 2 | 3 | 4 | 5;
  executedAgents: readonly string[];
  staleSlots: readonly string[];
  confirmedSlots: readonly string[];
  candidateSlots: readonly string[];
  slotDependenciesChanged: boolean;
  /** 이번 턴 planner-route 동적 슬롯 제안이 있었을 때만(검증 스냅샷 기준 slotKey) */
  suggestedDynamicSlots?: readonly string[];
  acceptedDynamicSlotKeys?: readonly string[];
  rejectedDynamicSlots?: readonly SingleChatDynamicSlotValidationRejectionV1[];
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

/**
 * @deprecated Bootstrap에서는 사용하지 않음 (단일 bootstrap LLM 호출로 통합됨).
 * 일반 turn 이후(필요 시) 동적 슬롯 제안을 분리 호출할 때만 사용.
 */
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

  const slotExpansionPhase = computeSlotExpansionPhaseFromState(input.baseState, input.definitions);

  const route = await runPlannerRouteTurnOpenAI({ ...input, slotExpansionPhase });
  if (!route.ok) return route;

  promptChunks.push(route.promptText);

  const suggestedSnapshot = cloneDynamicSlotProposalsFromPlannerRoute(route.suggestedSlots);
  const dynamicValidation =
    suggestedSnapshot.length > 0
      ? validateDynamicProposedSlots({
          nowIso: calledAt,
          baseDefinitions: definitions.filter((d) => !String(d.slotKey).startsWith("dyn_")),
          existingDynamicSlots: input.baseState.dynamicSlots ?? null,
          suggestedSlots: suggestedSnapshot,
        })
      : { accepted: [], rejected: [] };

  const stageGroupForDyn = input.definitions[0]?.stageGroup ?? SINGLE_CHAT_SERVICE_PLANNING_GROUP;

  if (dynamicValidation.accepted.length) {
    const dynDefs: SingleChatOrchestrationSlotDefinition[] = dynamicValidation.accepted.map((d) => ({
      slotKey: d.slotKey,
      label: d.title,
      ownerAgent: d.ownerAgent,
      stageGroup: stageGroupForDyn,
      hints: d.description,
      dependsOn: [],
    }));
    definitions.push(...dynDefs);
  }

  let state = mergeOrchestrationSlotPatches({
    base: input.baseState,
    patches: route.patches,
    nowIso: calledAt,
    definitions,
    propagateStaleFromPlanner: true,
  });

  if (suggestedSnapshot.length) {
    const dynSlotsMap: Record<string, SingleChatDynamicSlotDefinitionV1> = {
      ...(state.dynamicSlots ?? {}),
    };
    for (const d of dynamicValidation.accepted) {
      dynSlotsMap[d.slotKey] = d;
    }
    const prevRejected = Array.isArray(state.rejectedDynamicSlots) ? [...state.rejectedDynamicSlots] : [];
    const nextRejected = [...prevRejected, ...dynamicValidation.rejected];
    const prevHist = Array.isArray(state.slotProposalHistory) ? [...state.slotProposalHistory] : [];
    const histEntry: SingleChatDynamicSlotProposalHistoryV1 = {
      proposedAt: calledAt,
      suggestedSlots: suggestedSnapshot,
      acceptedSlotKeys: dynamicValidation.accepted.map((d) => d.slotKey),
      rejected: dynamicValidation.rejected,
    };
    state = {
      ...state,
      dynamicSlots: dynSlotsMap,
      rejectedDynamicSlots: nextRejected,
      slotProposalHistory: [...prevHist, histEntry],
    };
    state = ensureDynamicSlotRowsInState({
      state,
      accepted: dynamicValidation.accepted,
      nowIso: calledAt,
      stageGroup: stageGroupForDyn,
    });
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
      definitions,
      state,
      activeRoles: input.activeRoles,
      allowedOwners: FLOW_OWNERS,
      slotExpansionPhase,
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
      slotExpansionPhase,
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
      definitions,
      state,
      activeRoles: input.activeRoles,
      allowedOwners: SECURITY_OWNERS,
      slotExpansionPhase,
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

  const plannerStable = isPlannerStableEnough(state, definitions);
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

  const ownerLabelFromInternal = (owner: string): "planner" | "analyst" | "architect" | "designer" | "reviewer" | "security" => {
    const o = String(owner ?? "").trim().toLowerCase();
    if (o === "planner") return "planner";
    if (o === "service-designer" || o === "domain-expert") return "analyst";
    if (o === "solution-architect") return "architect";
    if (o === "ui-designer") return "designer";
    if (o === "task-reviewer") return "reviewer";
    if (o === "security-reviewer") return "security";
    return "planner";
  };

  const inferPhase = (): 1 | 2 | 3 | 4 | 5 => {
    // Heuristic phases: keep simple and stable — phase reflects which slot groups still have the biggest gap.
    const baseKeys = state.baseSlotKeys?.length ? new Set(state.baseSlotKeys.map((k) => String(k ?? "").trim()).filter(Boolean)) : null;
    const rows = Object.values(state.slots ?? {}).filter((s) => (baseKeys ? baseKeys.has(String((s as any).slotKey ?? "")) : true));
    const emptyBy: Record<string, number> = { planner: 0, analyst: 0, architect: 0, designer: 0, reviewer: 0, security: 0 };
    for (const r of rows) {
      const st = String((r as any).status ?? "");
      if (st && st.toLowerCase() !== "empty" && st.toLowerCase() !== "stale") continue;
      const label = ownerLabelFromInternal(String((r as any).ownerAgent ?? ""));
      emptyBy[label] += 1;
    }
    const plannerStable = isPlannerStableEnough(state, definitions);
    if (!plannerStable) return 1;
    const flow = emptyBy.analyst;
    const arch = emptyBy.architect;
    const design = emptyBy.designer;
    const reviewSec = emptyBy.reviewer + emptyBy.security;
    const max = Math.max(flow, arch, design, reviewSec);
    if (max === 0) return 5;
    if (max === flow) return 2;
    if (max === arch) return 3;
    if (max === design) return 4;
    return 5;
  };

  const pickNextOwner = (phase: 1 | 2 | 3 | 4 | 5): "planner" | "analyst" | "architect" | "designer" | "reviewer" | "security" => {
    if (phase === 1) return "planner";
    if (phase === 2) return "analyst";
    if (phase === 3) return "architect";
    if (phase === 4) return "designer";
    // Phase 5: alternate security/reviewer to avoid one-sided audits.
    return state.lastOrchestratorAgent === "security" ? "reviewer" : "security";
  };

  const phase = inferPhase();
  const nextOwner = pickNextOwner(phase);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  let nextQuestion = merge.assistantMessage;
  if (apiKey) {
    const model = resolveOpenAiModelFromEnv();
    const slotsJson = JSON.stringify(state.slots, null, 0).slice(0, 18_000);
    const keyHints = definitions
      .filter((d) => ownerLabelFromInternal(d.ownerAgent) === nextOwner)
      .slice(0, 10)
      .map((d) => `- ${d.label} (${d.slotKey})`)
      .join("\n");
    const persona =
      nextOwner === "planner"
        ? "planner(기획): 목적·범위·가치·협업 흐름"
        : nextOwner === "analyst"
          ? "analyst(분석): 액터·승인·예외·운영·권한 관계"
          : nextOwner === "architect"
            ? "architect(설계): 자동화 수준·구조·실시간/배치·연동·품질 검증·MVP 경계"
            : nextOwner === "designer"
              ? "designer(UX): 사용자 상호작용·화면 흐름·편집/피드백 UX"
              : nextOwner === "security"
                ? "security(보안): 개인정보·권한 경계·보관·접근제어"
                : "reviewer(리뷰): 범위/우선순위·리스크·검증 기준";
    const system = `${workspaceAiMemberSystemPrefix("ideation")}
당신은 SingleChat의 **다음 질문 생성기**입니다. 사용자에게 보이는 응답은 오직 질문 1문장만.
현재 당신의 관점은 ${persona} 입니다.
규칙:
- 질문은 한국어 1문장, 물음표 1개.
- 내부 슬롯 키/ownerAgent/phase 같은 용어를 절대 쓰지 마라.
- 사용자가 방금 말한 내용은 존중하되, 다음으로 필요한 결정 1개만 묻는다.
출력(JSON 1개): { "assistantMessage": "질문 한 문장" }`;
    const user = `[프로젝트] ${input.projectName.trim()}
[최근 사용자 발화] ${input.userMessage.trim().slice(0, 1600)}
[대화 발췌] ${input.dialogueExcerpt.trim().slice(0, 8000)}
[이 역할이 담당하는 슬롯(참고)]\n${keyHints || "- (없음)"}
[현재 슬롯 스냅샷] ${slotsJson}`;
    const resQ = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.25,
      responseFormatJsonObject: true,
      maxTokens: 160,
    });
    if (resQ.ok) {
      const parsed = safeJsonParse(resQ.text ?? "") as Record<string, unknown> | null;
      const msg = String(parsed?.assistantMessage ?? "").trim();
      if (msg) {
        nextQuestion = msg;
        promptChunks.push(`[next-question:${nextOwner}]\n[system]\n${system}\n\n[user]\n${user}\n\n[raw]\n${String(resQ.text ?? "").slice(0, 4000)}`);
        executedAgents.push(`question:${nextOwner}`);
      }
    }
  }

  const meta: SingleChatOrchestrationTurnMeta = {
    routingDecision: `orchestration_turn(${nextOwner})`,
    matchedSlots: route.matchedSlots,
    updatedSlotKeys: [...new Set(allUpdated)],
    updatedSlotCount: [...new Set(allUpdated)].length,
    delegatedAgents: uniqSpecialists,
    orchestratorAgent: nextOwner,
    nextQuestionOwnerAgent: nextOwner,
    currentPhase: phase,
    executedAgents: [...new Set(executedAgents)],
    staleSlots: buckets.stale,
    confirmedSlots: buckets.confirmed,
    candidateSlots: buckets.candidate,
    slotDependenciesChanged: slotDepsChanged,
    ...(suggestedSnapshot.length
      ? {
          suggestedDynamicSlots: suggestedSnapshot.map((s) => s.slotKey),
          acceptedDynamicSlotKeys: dynamicValidation.accepted.map((a) => a.slotKey),
          rejectedDynamicSlots: dynamicValidation.rejected,
        }
      : {}),
  };

  return {
    ok: true,
    assistantMessage: nextQuestion,
    nextState: {
      ...state,
      lastOrchestratorAgent: nextOwner,
      lastDelegatedAgents: uniqSpecialists,
      lastRoutingDecision: `orchestration_turn(${nextOwner})`,
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
    const feat = defByOwner("solution-architect").find((x) => x.slotKey.includes("coreFeatures"));
    if (feat) bump(feat.slotKey, feat.ownerAgent, "예약 기능 언급", 0.5, "solution-architect", "candidate");
  }
  if (/화면|UI|페이지/.test(um)) {
    const d = defByOwner("solution-architect").find((x) => x.slotKey.includes("requiredScreens"));
    if (d) bump(d.slotKey, d.ownerAgent, "화면/UI 언급", 0.45, "solution-architect", "candidate");
    const ui = defByOwner("ui-designer").find((x) => x.slotKey.includes(".design."));
    if (ui) bump(ui.slotKey, ui.ownerAgent, "UI 톤/IA 언급", 0.4, "ui-designer", "candidate");
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
