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
  /** 대화 소유권(UX/진단용) */
  conversationOwner?: string | null;
  /** 다음 질문 생성 주체(진단용; conversationOwner와 동일할 수 있음) */
  questionGeneratedBy?: string | null;
  /** 소유권 선택 근거(진단용) */
  ownershipReason?: string | null;
  /** 이번 턴의 지배적 결정 축(진단/라우팅용) */
  decisionAxis?: string | null;
  /** merge coordinator 역할(진단용; tone contamination 방지) */
  mergeCoordinator?: string | null;
  /** 내부 specialist contributor(진단용) */
  specialistContributors?: readonly string[];
  /** decision axis candidates (ranked; replay-friendly) */
  decisionAxisCandidates?: readonly { axis: string; score: number }[];
  /** ownership score breakdown (traceable) */
  ownershipScoreBreakdown?: Record<
    string,
    {
      unresolvedSlotWeight?: number;
      decisionAxisWeight?: number;
      momentumWeight?: number;
      explicitRoleMentionWeight?: number;
      orchestrationPhaseWeight?: number;
      totalScore?: number;
    }
  >;
  /** momentum contribution snapshot (per owner) */
  momentumContribution?: Record<string, number>;
  /** conflict signals (if any) */
  conflictSignals?: readonly string[];
  /** slot state transitions (patched keys only) */
  slotStateTransitions?: readonly { slotKey: string; from: string; to: string; reason?: string }[];
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
    // reviewer는 별도 참여 멤버가 아니라, 기획자가 중재 역할을 수행한다.
    if (o === "task-reviewer") return "planner";
    if (o === "security-reviewer") return "security";
    return "planner";
  };

  type NextOwner = "planner" | "analyst" | "architect" | "designer" | "reviewer" | "security";

  type DecisionAxis =
    | "ux_direction"
    | "mobile_experience"
    | "automation_latency"
    | "processing_pipeline"
    | "permissions_approval"
    | "collaboration_flow"
    | "scope_value"
    | "security_risk"
    | "unknown";

  type DecisionAxisCandidate = { axis: DecisionAxis; score: number };

  const inferDecisionAxisFromUserIntent = (userMessage: string): DecisionAxis => {
    const s = String(userMessage ?? "").trim().toLowerCase();
    if (!s) return "unknown";
    if (/(디자이너|ui|ux|화면|편집기|ia|정보구조|톤\s*&?\s*스타일|톤앤매너|모바일|리뷰\s*경험)/i.test(s)) return "ux_direction";
    if (/(바로|즉시|실시간|지연|latency|배치|처리\s*속도|업로드\s*직후|파이프라인|연동|api|확장|성능)/i.test(s)) return "automation_latency";
    if (/(권한|역할|참석자|작성자|검토자|승인|확정|검수|접근\s*제어|편집\s*권한)/i.test(s)) return "permissions_approval";
    if (/(협업|공동\s*편집|코멘트|댓글|수정\s*요청|히스토리|버전|워크플로우|흐름|프로세스)/i.test(s)) return "collaboration_flow";
    if (/(목적|가치|범위|mvp|우선순위|대상\s*사용자|성공\s*기준|kpi)/i.test(s)) return "scope_value";
    if (/(보안|개인정보|민감|저장|보관|감사|로그\s*보관|컴플라이언스)/i.test(s)) return "security_risk";
    return "unknown";
  };

  const resolveDecisionAxisCandidatesFromUserIntent = (userMessage: string): DecisionAxisCandidate[] => {
    const s = String(userMessage ?? "").trim().toLowerCase();
    if (!s) return [{ axis: "unknown", score: 0.4 }];
    const hit = (re: RegExp) => (re.test(s) ? 1 : 0);
    const candidates: DecisionAxisCandidate[] = [
      { axis: "ux_direction", score: 0.75 + 0.15 * hit(/(디자이너|ui|ux|편집기|ia|정보구조|톤\s*&?\s*스타일|리뷰\s*경험)/i) },
      { axis: "mobile_experience", score: 0.62 + 0.18 * hit(/(모바일|작은\s*화면|폰|태블릿|터치)/i) },
      { axis: "automation_latency", score: 0.7 + 0.2 * hit(/(실시간|바로|즉시|지연|latency|업로드\s*직후)/i) },
      { axis: "processing_pipeline", score: 0.58 + 0.22 * hit(/(파이프라인|처리\s*구조|배치|큐|비동기|연동|api|확장|성능)/i) },
      { axis: "permissions_approval", score: 0.7 + 0.2 * hit(/(권한|승인|확정|검토자|참석자별|역할)/i) },
      { axis: "collaboration_flow", score: 0.62 + 0.18 * hit(/(협업|공동\s*편집|댓글|코멘트|버전|히스토리)/i) },
      { axis: "scope_value", score: 0.62 + 0.18 * hit(/(목적|가치|범위|mvp|우선순위|kpi|성공\s*기준)/i) },
      { axis: "security_risk", score: 0.62 + 0.2 * hit(/(보안|개인정보|감사|보관|컴플라이언스)/i) },
    ];
    const ranked = candidates
      .map((c) => ({ ...c, score: Math.max(0, Math.min(1, Number(c.score.toFixed(3)))) }))
      .filter((c) => c.score >= 0.64)
      .sort((a, b) => b.score - a.score);
    if (!ranked.length) return [{ axis: inferDecisionAxisFromUserIntent(userMessage), score: 0.66 }];
    return ranked.slice(0, 5);
  };

  const ownerForAxis = (axis: DecisionAxis): NextOwner => {
    if (axis === "ux_direction" || axis === "mobile_experience") return "designer";
    if (axis === "automation_latency" || axis === "processing_pipeline") return "architect";
    if (axis === "permissions_approval" || axis === "collaboration_flow") return "analyst";
    if (axis === "scope_value") return "planner";
    if (axis === "security_risk") return "security";
    return "planner";
  };

  const resolveExplicitOwnerFromUserIntent = (userMessage: string): { owner: NextOwner; reason: string } | null => {
    const s = String(userMessage ?? "").trim().toLowerCase();
    if (!s) return null;
    // `@@` mention text is already in the user input (e.g. "@@AI 디자이너"), so plain substring checks work.
    // Priority: direct role naming > general keywords.
    const has = (re: RegExp) => re.test(s);

    // ui-designer
    if (has(/(디자이너|ui|ux|화면|편집기|ia|정보구조|톤\s*&?\s*스타일|톤앤매너|리뷰\s*경험)/i)) {
      return { owner: "designer", reason: "explicit_role_mention(ui-designer)" };
    }
    // solution-architect
    if (has(/(설계자|아키텍트|개발자\s*관점|구조|처리\s*구조|성능|확장|배치|실시간|연동|api|feasibility|가능성)/i)) {
      return { owner: "architect", reason: "explicit_role_mention(solution-architect)" };
    }
    // service-designer / domain-expert
    if (has(/(서비스\s*디자이너|도메인\s*전문가|분석가|액터|승인|협업|권한|운영|예외\s*처리|흐름|프로세스)/i)) {
      return { owner: "analyst", reason: "explicit_role_mention(service-designer)" };
    }
    // security-reviewer
    if (has(/(보안|개인정보|접근\s*제어|권한\s*경계|감사|로그\s*보관)/i)) {
      return { owner: "security", reason: "explicit_role_mention(security-reviewer)" };
    }
    // task-reviewer
    if (has(/(리뷰|검토|검수|품질|테스트|우선순위|리스크)/i)) {
      return { owner: "planner", reason: "explicit_role_mention(task-reviewer→planner_mediator)" };
    }
    return null;
  };

  const computeUnresolvedScoreByOwner = (): Record<NextOwner, number> => {
    const score: Record<NextOwner, number> = { planner: 0, analyst: 0, architect: 0, designer: 0, reviewer: 0, security: 0 };
    const rows = Object.values(state.slots ?? {});
    for (const r of rows) {
      const st = String((r as any).status ?? "").trim().toLowerCase();
      const conf = Number((r as any).confidence ?? 0);
      const label = ownerLabelFromInternal(String((r as any).ownerAgent ?? ""));
      if (st === "empty") score[label] += 1.0;
      else if (st === "stale") score[label] += 0.75;
      else if (st === "candidate") score[label] += 0.55;
      else if (st === "partial") score[label] += conf >= 0.8 ? 0.15 : 0.35;
      else if (st === "conflicted") score[label] += 0.9;
      else if (st === "blocked") score[label] += 0.6;
    }
    return score;
  };

  const ownerBoostFromDecisionAxisCandidates = (
    candidates: readonly DecisionAxisCandidate[]
  ): Partial<Record<NextOwner, number>> => {
    const boost: Partial<Record<NextOwner, number>> = {};
    for (const c of candidates.slice(0, 3)) {
      const o = ownerForAxis(c.axis);
      const w = c.score >= 0.85 ? 0.95 : c.score >= 0.75 ? 0.7 : 0.45;
      boost[o] = (boost[o] ?? 0) + w;
    }
    return boost;
  };

  const resolveNextConversationOwner = (
    phaseOwner: NextOwner,
    axisCandidates: readonly DecisionAxisCandidate[],
    momentumWeights: Record<NextOwner, number>
  ): { owner: NextOwner; reason: string; breakdown: SingleChatOrchestrationTurnMeta["ownershipScoreBreakdown"] } => {
    const explicit = resolveExplicitOwnerFromUserIntent(input.userMessage);
    if (explicit) {
      const breakdown: any = {
        [explicit.owner]: {
          unresolvedSlotWeight: 0,
          decisionAxisWeight: 0,
          momentumWeight: 0,
          explicitRoleMentionWeight: 2.0,
          orchestrationPhaseWeight: explicit.owner === phaseOwner ? 0.35 : 0,
          totalScore: 2.0,
        },
      };
      return { owner: explicit.owner, reason: explicit.reason, breakdown };
    }

    const unresolved = computeUnresolvedScoreByOwner();
    const axisBoost = ownerBoostFromDecisionAxisCandidates(axisCandidates);

    const score: Record<NextOwner, number> = { planner: 0, analyst: 0, architect: 0, designer: 0, reviewer: 0, security: 0 };
    const breakdown: Record<string, any> = {};
    for (const k of Object.keys(score) as NextOwner[]) {
      const unresolvedSlotWeight = unresolved[k] * 1.0;
      const decisionAxisWeight = typeof axisBoost[k] === "number" ? (axisBoost[k] as number) : 0;
      const orchestrationPhaseWeight = k === phaseOwner ? 0.35 : 0;
      const momentumWeight = momentumWeights[k] ?? 0;
      const explicitRoleMentionWeight = 0;
      const totalScore = unresolvedSlotWeight + decisionAxisWeight + orchestrationPhaseWeight + momentumWeight;
      breakdown[k] = {
        unresolvedSlotWeight: Number(unresolvedSlotWeight.toFixed(3)),
        decisionAxisWeight: Number(decisionAxisWeight.toFixed(3)),
        momentumWeight: Number(momentumWeight.toFixed(3)),
        explicitRoleMentionWeight,
        orchestrationPhaseWeight: Number(orchestrationPhaseWeight.toFixed(3)),
        totalScore: Number(totalScore.toFixed(3)),
      };
      score[k] = totalScore;
    }

    const ranked = (Object.keys(score) as NextOwner[])
      .map((k) => ({ owner: k, score: Number(score[k].toFixed(3)) }))
      .sort((a, b) => b.score - a.score);
    const top = ranked[0];
    const second = ranked[1];
    if (!top) return { owner: phaseOwner, reason: `phase_default(${phaseOwner})`, breakdown };
    const gap = top.score - (second?.score ?? 0);
    const switchingAwayFromPlanner = phaseOwner === "planner" && top.owner !== "planner" && gap >= 0.15;
    const switchingBetweenSpecialists = phaseOwner !== "planner" && gap >= 0.25;
    const chosen = switchingAwayFromPlanner || switchingBetweenSpecialists ? top.owner : phaseOwner;
    const reason = chosen === phaseOwner ? `weighted_keep_phase(${phaseOwner})` : `weighted_owner(${top.owner})`;
    return { owner: chosen, reason: `${reason}; axisTop=${axisCandidates[0]?.axis ?? "unknown"}; gap=${gap.toFixed(2)}`, breakdown };
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

  const pickNextOwner = (phase: 1 | 2 | 3 | 4 | 5): NextOwner => {
    if (phase === 1) return "planner";
    if (phase === 2) return "analyst";
    if (phase === 3) return "architect";
    if (phase === 4) return "designer";
    // Phase 5: alternate security/reviewer to avoid one-sided audits.
    return state.lastOrchestratorAgent === "security" ? "planner" : "security";
  };

  const phase = inferPhase();
  const phaseOwner = pickNextOwner(phase);
  const MOMENTUM_DECAY = 0.85;
  const MAX_OWNER_STICKINESS = 0.35;
  const ownerMomentumPrev =
    (state.ownerMomentum ?? null) && typeof state.ownerMomentum === "object" ? (state.ownerMomentum as Record<string, number>) : {};
  const baseMomentum: Record<NextOwner, number> = { planner: 0, analyst: 0, architect: 0, designer: 0, reviewer: 0, security: 0 };
  for (const k of Object.keys(baseMomentum) as NextOwner[]) {
    const v = Number(ownerMomentumPrev[k] ?? 0);
    baseMomentum[k] = Number.isFinite(v) ? Math.max(0, Math.min(1.2, v)) : 0;
  }
  const decayedMomentum: Record<NextOwner, number> = { ...baseMomentum };
  for (const k of Object.keys(decayedMomentum) as NextOwner[]) decayedMomentum[k] = Number((decayedMomentum[k] * MOMENTUM_DECAY).toFixed(3));
  const momentumWeights: Record<NextOwner, number> = { ...decayedMomentum };
  for (const k of Object.keys(momentumWeights) as NextOwner[]) momentumWeights[k] = Math.min(MAX_OWNER_STICKINESS, Number((momentumWeights[k] * 0.3).toFixed(3)));

  const decisionAxisCandidates = resolveDecisionAxisCandidatesFromUserIntent(input.userMessage);
  const decisionAxis = decisionAxisCandidates[0]?.axis ?? inferDecisionAxisFromUserIntent(input.userMessage);
  const resolvedOwner = resolveNextConversationOwner(phaseOwner, decisionAxisCandidates, momentumWeights);
  const nextOwner = resolvedOwner.owner;
  const ownershipReason = resolvedOwner.reason;
  const ownershipScoreBreakdown = resolvedOwner.breakdown;
  const ownerMomentumNext: Record<NextOwner, number> = { ...decayedMomentum };
  ownerMomentumNext[nextOwner] = Number(Math.min(1.2, ownerMomentumNext[nextOwner] + 0.35).toFixed(3));
  console.info("[orchestration-owner]", {
    conversationOwner: nextOwner,
    questionGeneratedBy: nextOwner,
    ownershipReason,
    decisionAxis,
    phase,
    phaseOwner,
  });

  const top1 = decisionAxisCandidates[0] ?? null;
  const top2 = decisionAxisCandidates[1] ?? null;
  const conflictSignals: string[] = [];
  const explicitMentionChosen = String(ownershipReason ?? "").startsWith("explicit_role_mention");
  const conflictDetected =
    Boolean(top1 && top2) &&
    Number(top1?.score ?? 0) >= 0.7 &&
    Number(top2?.score ?? 0) >= 0.66 &&
    ownerForAxis(top1!.axis) !== ownerForAxis(top2!.axis) &&
    Math.abs(Number(top1!.score) - Number(top2!.score)) <= 0.12 &&
    // explicit role mention must win over conflict mediation
    !explicitMentionChosen;
  if (conflictDetected && top1 && top2) {
    conflictSignals.push(`axis_conflict(${top1.axis}:${top1.score.toFixed(2)} vs ${top2.axis}:${top2.score.toFixed(2)})`);
  }

  // Conflict mediation: 기획자가 중재 역할로 발화한다(리뷰어는 별도 멤버로 노출하지 않음).
  const conversationOwner: NextOwner = conflictDetected ? "planner" : nextOwner;
  const questionGeneratedBy: NextOwner = conversationOwner;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const buildOwnerFallbackQuestion = (): string => {
    // Ensure owner voice even without LLM.
    if (nextOwner === "designer") return "회의록 검토/수정 화면은 문서 편집기 스타일과 댓글 기반 검토 중 어떤 흐름이 더 자연스럽나요?";
    if (nextOwner === "architect") return "업로드 후 결과는 실시간에 가깝게 즉시 나와야 하나요, 아니면 배치 처리도 허용되나요?";
    if (nextOwner === "analyst") return "참석자는 회의록 전체를 수정하나요, 아니면 자신의 발언만 수정하나요?";
    if (nextOwner === "security") return "녹취/전사 데이터는 어느 기간 보관하고, 누가 접근할 수 있어야 하나요?";
    if (nextOwner === "reviewer") return "첫 버전에서 꼭 확정해야 할 품질 기준(예: 화자 분리 정확도/요약 품질)은 무엇인가요?";
    return "이 서비스의 첫 버전에서 반드시 해결해야 할 핵심 목표를 한 문장으로 정리해 주실래요?";
  };
  const buildConflictMediationQuestion = (): string => {
    const label = (a: DecisionAxis): string => {
      if (a === "ux_direction" || a === "mobile_experience") return "검토·편집 UX";
      if (a === "automation_latency" || a === "processing_pipeline") return "처리 구조/속도";
      if (a === "permissions_approval" || a === "collaboration_flow") return "권한·협업 흐름";
      if (a === "security_risk") return "보안·데이터 보관";
      if (a === "scope_value") return "범위·가치";
      return "우선순위";
    };
    const a1 = top1?.axis ?? "unknown";
    const a2 = top2?.axis ?? "unknown";
    return `지금은 ${label(a1)}과 ${label(a2)} 중 어느 쪽을 먼저 확정하는 게 더 중요할까요?`;
  };

  let nextQuestion = conflictDetected ? buildConflictMediationQuestion() : buildOwnerFallbackQuestion();
  let personaValidationReason: string | null = null;
  let personaValidationRetry = 0;

  // Conflict slot marking (replay + routing safety): mark representative slots for competing owners as conflicted.
  const conflictPatchedKeys: string[] = [];
  if (conflictDetected && top1 && top2) {
    const owners = [ownerForAxis(top1.axis), ownerForAxis(top2.axis)];
    for (const o of owners) {
      const def = definitions.find((d) => ownerLabelFromInternal(d.ownerAgent) === o);
      if (!def) continue;
      const row = state.slots[def.slotKey];
      if (!row) continue;
      const st = String(row.status ?? "empty").trim().toLowerCase();
      if (st === "confirmed") continue;
      state = mergeOrchestrationSlotPatches({
        base: state,
        patches: [
          {
            slotKey: def.slotKey,
            status: "conflicted",
            staleReason: "axis_conflict",
            derivedFrom: row.derivedFrom ?? null,
          } as any,
        ],
        nowIso: new Date().toISOString(),
        definitions,
        propagateStaleFromPlanner: false,
      });
      conflictPatchedKeys.push(def.slotKey);
    }
    if (conflictPatchedKeys.length) {
      conflictSignals.push(`conflicted_slots(${conflictPatchedKeys.slice(0, 4).join(",")})`);
    }
  }
  if (apiKey) {
    const model = resolveOpenAiModelFromEnv();
    const slotsJson = JSON.stringify(state.slots, null, 0).slice(0, 18_000);
    const keyHints = definitions
      .filter((d) => ownerLabelFromInternal(d.ownerAgent) === conversationOwner)
      .slice(0, 10)
      .map((d) => `- ${d.label} (${d.slotKey})`)
      .join("\n");
    const baseRules = [
      "당신은 SingleChat의 다음 대화 진행자(conversation owner)다.",
      "출력은 사용자에게 보이는 질문 1문장만 생성한다(물음표 1개).",
      "‘구체적인 요구사항이 있을까요?’ 같은 기획자 톤의 일반론 질문 금지.",
      "내부 슬롯 키/ownerAgent/phase/오케스트레이션 용어 금지.",
      "사용자가 방금 한 말의 방향을 이어서, 결정을 전진시키는 질문 1개만 묻는다.",
      '출력(JSON 1개): { "assistantMessage": "질문 한 문장" }',
    ].join("\n");

    const roleSystem =
      conflictDetected
        ? [
            `${workspaceAiMemberSystemPrefix("ideation")}`,
            "당신의 공식 표시 이름은「AI 기획자」이다.",
            "당신은 여러 specialist 관점을 조정하는 중립적 조정자(mediator)다.",
            "목표는 상충되는 요구를 조정하기 위한 '선택 질문'을 1문장으로 만드는 것이다.",
            "질문은 트레이드오프를 명확히 드러내되, 기획자식 일반론 질문은 금지한다.",
            baseRules,
          ].join("\n")
        :
      conversationOwner === "designer"
        ? [
            `${workspaceAiMemberSystemPrefix("ideation")}`,
            "당신의 공식 표시 이름은「AI 디자이너」이다.",
            "당신은 숙련된 UX/UI 디자이너다. 대화를 리드하면서 사용자의 검토/수정 경험을 구체화한다.",
            "초점: 편집 UX, 리뷰 UX(댓글/승인), 문서 IA, 모바일 사용성, 톤&스타일.",
            "질문 예시 톤: ‘검토 화면은 문서 편집기 스타일과 댓글 기반 중 어떤 흐름이 더 자연스럽나요?’",
            baseRules,
          ].join("\n")
        : conversationOwner === "architect"
          ? [
              `${workspaceAiMemberSystemPrefix("ideation")}`,
              "당신의 공식 표시 이름은「AI 설계자」이다.",
              "당신은 시스템/자동화 구조를 설계하는 AI 설계자다. 처리 구조와 성능/연동 경계를 리드한다.",
              "초점: 실시간 vs 배치, 자동화 경계, 처리 파이프라인, 연동/API, 확장성/비용.",
              "질문 예시 톤: ‘업로드 직후 처리해야 하나요, 배치 처리도 허용되나요?’",
              baseRules,
            ].join("\n")
          : conversationOwner === "analyst"
            ? [
                `${workspaceAiMemberSystemPrefix("ideation")}`,
                "당신의 공식 표시 이름은「AI 분석가」이다.",
                "당신은 서비스 흐름/권한/승인을 분석하는 AI 분석가다. 역할과 운영 흐름을 리드한다.",
                "초점: 액터 책임, 승인/확정 흐름, 협업/공동편집, 권한(누가 무엇을), 예외/운영.",
                "질문 예시 톤: ‘참석자는 전체를 고치나요, 자기 발언만 고치나요?’",
                baseRules,
              ].join("\n")
            : conversationOwner === "security"
              ? [
                  `${workspaceAiMemberSystemPrefix("ideation")}`,
                  "당신의 공식 표시 이름은「AI 보안관」이다.",
                  "당신은 보안/개인정보 관점의 AI 보안 리뷰어다. 데이터/권한/보관 정책 리스크를 리드한다.",
                  "초점: 개인정보/민감정보, 접근 제어, 보관 기간, 감사 로그, 공유 범위.",
                  "질문 예시 톤: ‘녹취/전사 데이터는 누가 볼 수 있고 얼마나 보관하나요?’",
                  baseRules,
                ].join("\n")
              : conversationOwner === "reviewer"
                ? [
                    `${workspaceAiMemberSystemPrefix("ideation")}`,
                    "당신의 공식 표시 이름은「AI 리뷰어」이다.",
                    "당신은 범위/리스크/검증기준을 점검하는 AI 리뷰어다. 우선순위와 성공 기준을 리드한다.",
                    "초점: MVP 범위, 품질 기준, 검증 방법, 리스크/트레이드오프.",
                    "질문 예시 톤: ‘첫 버전에서 어떤 품질 기준을 반드시 만족해야 하나요?’",
                    baseRules,
                  ].join("\n")
                : [
                    `${workspaceAiMemberSystemPrefix("ideation")}`,
                    "당신의 공식 표시 이름은「AI 기획자」이다.",
                    "당신은 제품 기획자(planner)다. 비즈니스 가치/범위/목표 정렬을 리드한다.",
                    "초점: 목적/핵심가치, 범위/MVP, 이해관계자 정렬, 협업 방향.",
                    "질문 예시 톤: ‘첫 버전에서 가장 중요한 성공 기준은 무엇인가요?’",
                    baseRules,
                  ].join("\n");

    const user = `[프로젝트] ${input.projectName.trim()}
[최근 사용자 발화] ${input.userMessage.trim().slice(0, 1600)}
[대화 발췌] ${input.dialogueExcerpt.trim().slice(0, 8000)}
[이 역할이 담당하는 슬롯(참고)]\n${keyHints || "- (없음)"}
[현재 슬롯 스냅샷] ${slotsJson}
[결정 축] ${decisionAxis}`;
    const resQ = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: roleSystem },
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
        const validate = (owner: NextOwner, q: string): { ok: boolean; reason?: string } => {
          const qq = String(q ?? "").trim();
          if (!qq) return { ok: false, reason: "empty_question" };
          const forbidCommon = /(추가\s*요구사항|구체적인\s*요구사항|원하시나요|원하나요)/i;
          if (forbidCommon.test(qq)) return { ok: false, reason: "forbidden_generic_phrase" };
          if (owner === "designer" && /(기능|요소|요구사항|스펙)/i.test(qq)) return { ok: false, reason: "designer_planner_tone_leak" };
          if (owner === "architect" && /(디자인|톤앤매너|ui|ux)/i.test(qq)) return { ok: false, reason: "architect_focus_leak" };
          if (owner === "analyst" && /(성능|지연|파이프라인|실시간|배치)/i.test(qq)) return { ok: false, reason: "analyst_focus_leak" };
          return { ok: true };
        };

        const v1 = validate(conversationOwner, msg);
        if (v1.ok) {
          nextQuestion = msg;
          promptChunks.push(`[next-question:${conversationOwner}]\n[system]\n${roleSystem}\n\n[user]\n${user}\n\n[raw]\n${String(resQ.text ?? "").slice(0, 4000)}`);
          executedAgents.push(`question:${conversationOwner}`);
        } else {
          personaValidationReason = v1.reason ?? "persona_validation_failed";
          personaValidationRetry = 1;
          const retrySystem = `${roleSystem}\n\n[persona-validation]\n이전 질문은 ${personaValidationReason} 로 거절되었습니다. 금지어/톤을 피하고, 역할 관점에 맞는 질문 1문장만 다시 생성하세요.`;
          const resRetry = await postOpenAiChatCompletion({
            apiKey,
            model,
            messages: [
              { role: "system", content: retrySystem },
              { role: "user", content: user },
            ],
            temperature: 0.22,
            responseFormatJsonObject: true,
            maxTokens: 160,
          });
          if (resRetry.ok) {
            const parsed2 = safeJsonParse(resRetry.text ?? "") as Record<string, unknown> | null;
            const msg2 = String(parsed2?.assistantMessage ?? "").trim();
            const v2 = validate(conversationOwner, msg2);
            if (msg2 && v2.ok) {
              nextQuestion = msg2;
              promptChunks.push(
                `[next-question:${conversationOwner}:retry]\n[system]\n${retrySystem}\n\n[user]\n${user}\n\n[raw]\n${String(resRetry.text ?? "").slice(0, 4000)}`
              );
              executedAgents.push(`question:${conversationOwner}:retry`);
            }
          }
        }
      }
    }
  }

  const patchedKeys = [...new Set([...allUpdated, ...conflictPatchedKeys])];
  const slotStateTransitions = patchedKeys
    .map((k) => {
      const prev = input.baseState.slots?.[k];
      const next = state.slots?.[k];
      const from = String(prev?.status ?? "").trim();
      const to = String(next?.status ?? "").trim();
      if (!from || !to || from === to) return null;
      const reason =
        typeof next?.staleReason === "string" && next.staleReason.trim()
          ? next.staleReason.trim()
          : typeof next?.derivedFrom === "string" && next.derivedFrom.trim()
            ? next.derivedFrom.trim()
            : undefined;
      return { slotKey: k, from, to, ...(reason ? { reason: reason.slice(0, 120) } : {}) };
    })
    .filter(Boolean) as Array<{ slotKey: string; from: string; to: string; reason?: string }>;

  const meta: SingleChatOrchestrationTurnMeta = {
    routingDecision: `orchestration_turn(${conversationOwner})`,
    matchedSlots: route.matchedSlots,
    updatedSlotKeys: [...new Set(allUpdated)],
    updatedSlotCount: [...new Set(allUpdated)].length,
    delegatedAgents: uniqSpecialists,
    orchestratorAgent: conversationOwner,
    nextQuestionOwnerAgent: conversationOwner,
    conversationOwner,
    questionGeneratedBy,
    ownershipReason,
    decisionAxis,
    mergeCoordinator: "merge-coordinator",
    specialistContributors: uniqSpecialists,
    decisionAxisCandidates: decisionAxisCandidates.map((c) => ({ axis: c.axis, score: c.score })),
    ownershipScoreBreakdown,
    momentumContribution: momentumWeights,
    ...(conflictSignals.length ? { conflictSignals } : {}),
    ...(slotStateTransitions.length ? { slotStateTransitions } : {}),
    ...(typeof input.orchestrationWakeupReason === "string" && input.orchestrationWakeupReason.trim()
      ? { orchestrationWakeupReason: input.orchestrationWakeupReason.trim().slice(0, 120) }
      : {}),
    ...(typeof input.orchestrationLazyInit === "boolean" ? { orchestrationLazyInit: input.orchestrationLazyInit } : {}),
    ...(personaValidationReason ? { personaValidationReason } : {}),
    ...(typeof personaValidationRetry === "number" ? { personaValidationRetry } : {}),
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
      lastOrchestratorAgent: conversationOwner,
      lastDelegatedAgents: uniqSpecialists,
      lastRoutingDecision: `orchestration_turn(${conversationOwner})`,
      ownerMomentum: ownerMomentumNext,
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

  const detectExplicitOwner = (): "planner" | "analyst" | "architect" | "designer" | "reviewer" | "security" | null => {
    const s = um.toLowerCase();
    if (/(디자이너|ui|ux)/i.test(s)) return "designer";
    if (/(설계자|아키텍트|개발자\s*관점|실시간|배치|파이프라인|연동)/i.test(s)) return "architect";
    if (/(분석가|도메인\s*전문가|승인|권한|협업|흐름)/i.test(s)) return "analyst";
    if (/(보안|개인정보|감사|보관)/i.test(s)) return "security";
    if (/(리뷰어|검토|검수|우선순위|리스크)/i.test(s)) return "reviewer";
    return null;
  };
  const explicitOwner = detectExplicitOwner();

  const routingDecision =
    patches.length === 0
      ? "E: 슬롯 미충족 — 후속 질문 필요 (fallback, planner-only)"
      : delegatedList.length > 1
        ? `D: 다중 후보 (fallback, specialist 미호출) — ${delegatedList.join(",")}`
        : delegatedList.length === 1
          ? `B/C: 후보 슬롯 (fallback) — ${delegatedList[0]}`
          : "A: planner 영역 (fallback)";

  const roleFallbackQuestion = (owner: NonNullable<typeof explicitOwner> | "planner"): string => {
    if (owner === "designer") return "회의록 검토/수정 화면은 문서 편집기 스타일과 댓글 기반 검토 중 어떤 흐름이 더 자연스럽나요?";
    if (owner === "architect") return "업로드 후 결과는 실시간에 가깝게 즉시 나와야 하나요, 아니면 배치 처리도 허용되나요?";
    if (owner === "analyst") return "참석자는 회의록 전체를 수정하나요, 아니면 자신의 발언만 수정하나요?";
    if (owner === "security") return "녹취/전사 데이터는 어느 기간 보관하고, 누가 접근할 수 있어야 하나요?";
    if (owner === "reviewer") return "첫 버전에서 꼭 확정해야 할 품질 기준(예: 화자 분리 정확도/요약 품질)은 무엇인가요?";
    return "이 서비스의 첫 버전에서 반드시 해결해야 할 핵심 목표를 한 문장으로 정리해 주실래요?";
  };

  const msg = explicitOwner ? roleFallbackQuestion(explicitOwner) : patches.length === 0
    ? "말씀해 주신 내용을 바탕으로 조금만 더 구체화하고 싶습니다. 가장 먼저 해결하려는 사용자의 문제를 한 문장으로 알려주실 수 있을까요?"
    : `좋습니다. 현재 답변을 반영해 필요한 정보를 정리했습니다.\n\n한 가지만 더 알려주세요. 지금 단계에서 가장 불확실한 부분은 무엇인가요?`;

  const buckets = slotBucketsByStatus(nextState);

  const meta: SingleChatOrchestrationTurnMeta = {
    routingDecision,
    matchedSlots: matched,
    updatedSlotKeys: patches.map((p) => p.slotKey),
    delegatedAgents: [],
    orchestratorAgent: explicitOwner ?? "planner",
    conversationOwner: explicitOwner ?? "planner",
    questionGeneratedBy: explicitOwner ?? "planner",
    ownershipReason: explicitOwner ? "explicit_role_mention(fallback)" : "fallback_no_llm",
    executedAgents: [explicitOwner ? `fallback:${explicitOwner}` : "planner"],
    staleSlots: buckets.stale,
    confirmedSlots: buckets.confirmed,
    candidateSlots: buckets.candidate,
    slotDependenciesChanged: patches.some((p) => input.baseState.slots[p.slotKey]?.ownerAgent === "planner"),
  };

  nextState = {
    ...nextState,
    lastOrchestratorAgent: explicitOwner ?? "planner",
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
