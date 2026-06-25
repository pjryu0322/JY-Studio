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
import { runCoordinatorSynthesisTurnOpenAI } from "@/lib/requirements/singleChatOrchestrationOpenAI.coordinatorSynthesis";
import { runPlannerMergeTurnOpenAI } from "@/lib/requirements/singleChatOrchestrationOpenAI.plannerMerge";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import { safeJsonParse } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";
import { wrapReferenceContextForOrchestrationLlm } from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";
import { runProposalAcceptedNextStageOpenAI, buildProposalAcceptedNextStageFallback } from "@/lib/requirements/singleChatProposalAcceptedNextStage";
import {
  hashProposalResponse,
  shouldBlockProposalReplay,
  shouldRegisterPendingProposal,
  transitionLifecycleOnDecision,
  transitionLifecycleOnPendingProposal,
  type SingleChatProposalLifecycleV1,
} from "@/lib/requirements/singleChatProposalLifecycle";
import {
  augmentUserMessageForLlm,
  classifyProposalDecision,
  classifyQuickAction,
  quickActionNextQuestionBlock,
  routingUserMessageForHeuristics,
  type ProposalDecision,
} from "@/lib/requirements/singleChatQuickAction";

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
  /** 이전 conversation owner (persistence; optional) */
  previousConversationOwner?: string | null;
  /** active owner (persistence; optional) */
  activeConversationOwner?: string | null;
  /** owner persistence reason (persistence; optional) */
  ownerPersistenceReason?: string | null;
  /** remaining sticky turns (persistence; optional) */
  stickyTurnsRemaining?: number | null;
  /** 이번 턴의 지배적 결정 축(진단/라우팅용) */
  decisionAxis?: string | null;
  /** 이전 decision axis (persistence; optional) */
  previousDecisionAxis?: string | null;
  /** decision axis source (persistence; optional) */
  decisionAxisSource?: string | null;
  /** owner-axis mismatch detected (UX/diagnostic) */
  ownerAxisMismatch?: boolean | null;
  /** 반복 질문 감지 여부 */
  repeatedQuestionDetected?: boolean | null;
  /** 반복 질문 감지 사유 */
  repeatedQuestionReason?: string | null;
  /** next-question 재시도 사유 */
  nextQuestionRetryReason?: string | null;
  /** UI: quick action suggestions (chips) */
  interviewSuggestions?: readonly string[];
  /** 사용자가 선택한 QuickAction 칩 라벨(있을 때만) */
  quickActionLabel?: string | null;
  /** QuickAction 의도 분류 */
  quickActionKind?: string | null;
  /** proposal decision signal */
  proposalDecision?: ProposalDecision | null;
  proposalLifecyclePhase?: string | null;
  proposalApplyFastPath?: boolean | null;
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

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function uniqueOrchestrationUpdatedSlotKeys(patches: ReadonlyArray<{ slotKey: string }>): readonly string[] {
  return uniqueStrings(patches.map((p) => p.slotKey));
}

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

/** @deprecated Do not merge reference context into projectDescription; use referencePromptContextBlock. */
export function mergeReferencePlanningContextIntoOrchestrationProjectDescription(
  projectDescription: string,
  referencePlanningContextBlock?: string | null,
): string {
  const referenceBlock = String(referencePlanningContextBlock ?? "").trim().slice(0, 6000);
  const base = String(projectDescription ?? "").trim();
  if (!referenceBlock) return base;
  return `${base}\n\n${referenceBlock}`.trim().slice(0, 12_000);
}

export function resolveReferencePromptContextBlockForOrchestration(input: Readonly<{
  readonly referencePromptContextBlock?: string;
  readonly referencePlanningContextBlock?: string;
}>): string {
  const raw = String(input.referencePromptContextBlock ?? input.referencePlanningContextBlock ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("[reference_context]")) return raw.slice(0, 6200);
  return wrapReferenceContextForOrchestrationLlm(raw);
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
  readonly orchestrationWakeupReason?: string;
  readonly orchestrationLazyInit?: boolean;
  /** Reference Snapshot prompt section ([reference_context], 6000자 이내) */
  readonly referencePromptContextBlock?: string;
  /** @deprecated alias of referencePromptContextBlock */
  readonly referencePlanningContextBlock?: string;
  /** 인터뷰/오케스트레이션 QuickAction 칩(추천안 적용 등) */
  readonly quickActionLabel?: string | null;
  /** proposal 승인 신호(칩 라벨과 별도 전달 가능) */
  readonly proposalDecision?: ProposalDecision | null;
}): Promise<SingleChatOrchestrationTurnResult> {
  const calledAt = new Date().toISOString();
  const promptChunks: string[] = [];
  const executedAgents: string[] = ["planner-route"];
  const coordinatorChipSuggestionsRef: { current: string[] | null } = { current: null };

  const rawUserMessage = String(input.userMessage ?? "").trim();
  const quickActionLabel = String(input.quickActionLabel ?? "").trim() || null;
  const quickActionKind = classifyQuickAction(quickActionLabel);
  const proposalDecision: ProposalDecision | null =
    input.proposalDecision ?? classifyProposalDecision(quickActionLabel);
  const userMessageForLlm = augmentUserMessageForLlm(rawUserMessage, quickActionLabel, proposalDecision);
  const routingUserMessage = routingUserMessageForHeuristics(rawUserMessage, quickActionLabel);
  let proposalLifecycle: SingleChatProposalLifecycleV1 | null = input.baseState.proposalLifecycleV1 ?? null;

  // Definitions can grow during the turn (hybrid dynamic slots).
  let definitions = [...input.definitions];

  const slotExpansionPhase = computeSlotExpansionPhaseFromState(input.baseState, input.definitions);

  const referencePromptContextBlock = resolveReferencePromptContextBlockForOrchestration(input);

  const route = await runPlannerRouteTurnOpenAI({
    ...input,
    referencePromptContextBlock,
    userMessage: userMessageForLlm,
    slotExpansionPhase,
  });
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
      referencePromptContextBlock,
      userMessage: userMessageForLlm,
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
      referencePromptContextBlock,
      userMessage: userMessageForLlm,
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
      referencePromptContextBlock,
      userMessage: userMessageForLlm,
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
    referencePromptContextBlock,
    userMessage: userMessageForLlm,
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

  const detectContextDependentFollowup = (userMessage: string): boolean => {
    const raw = String(userMessage ?? "").trim();
    if (!raw) return false;
    // explicit owner/role mention should not be treated as generic follow-up
    if (/(디자이너|설계자|분석가|보안|리뷰어|기획자|@@)/i.test(raw)) return false;
    // short, context-dependent utterances
    if (raw.length <= 14 && /(예시|더\s*설명|구체화|자세히|다시\s*정리|정리해줘|한\s*번\s*더)/i.test(raw)) return true;
    if (raw.length <= 10 && /(그래서\?|그럼\?|그럼|그렇다면|오케이|좋아|맞아|응|네)/i.test(raw)) return true;
    return false;
  };

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

  const resolveDecisionAxisCandidatesFromUserIntent = (
    userMessage: string,
    prevCandidates?: readonly { axis: string; score: number }[] | null
  ): { candidates: DecisionAxisCandidate[]; source: "currentMessage" | "previousContext" | "fallback" } => {
    const s = String(userMessage ?? "").trim().toLowerCase();
    if (!s) {
      if (Array.isArray(prevCandidates) && prevCandidates.length) {
        const prev = prevCandidates
          .map((c) => ({ axis: String((c as any).axis ?? "").trim() as DecisionAxis, score: Number((c as any).score) }))
          .filter((c) => Boolean(c.axis) && Number.isFinite(c.score))
          .map((c) => ({ axis: c.axis, score: Math.max(0, Math.min(1, Number(c.score.toFixed(3)))) }))
          .slice(0, 5);
        if (prev.length) return { candidates: prev, source: "previousContext" };
      }
      return { candidates: [{ axis: "unknown", score: 0.4 }], source: "fallback" };
    }
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
    const contextDependent = detectContextDependentFollowup(userMessage);
    if (contextDependent && Array.isArray(prevCandidates) && prevCandidates.length) {
      const blended = new Map<DecisionAxis, number>();
      for (const p of prevCandidates) {
        const ax = String((p as any).axis ?? "").trim() as DecisionAxis;
        const sc = Number((p as any).score);
        if (!ax || !Number.isFinite(sc)) continue;
        blended.set(ax, Math.max(blended.get(ax) ?? 0, Math.max(0, Math.min(1, Number((sc * 0.92).toFixed(3))))));
      }
      for (const c of ranked.slice(0, 3)) {
        blended.set(c.axis, Math.max(blended.get(c.axis) ?? 0, Math.max(0, Math.min(1, Number((c.score * 0.75).toFixed(3))))));
      }
      const out = [...blended.entries()]
        .map(([axis, score]) => ({ axis, score: Math.max(0, Math.min(1, Number(score.toFixed(3)))) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      if (out.length) return { candidates: out, source: "previousContext" };
    }
    if (!ranked.length) return { candidates: [{ axis: inferDecisionAxisFromUserIntent(userMessage), score: 0.66 }], source: "fallback" };
    return { candidates: ranked.slice(0, 5), source: "currentMessage" };
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
    // planner
    if (has(/(기획자|플래너|planner|정리해줘|요약해줘)/i)) {
      return { owner: "planner", reason: "explicit_role_mention(planner)" };
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
    const explicit = resolveExplicitOwnerFromUserIntent(routingUserMessage);
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

  const previousConversationOwner =
    typeof (state as any).lastConversationOwner === "string" ? String((state as any).lastConversationOwner).trim() : null;
  const activeConversationOwnerRaw =
    typeof (state as any).activeConversationOwner === "string" ? String((state as any).activeConversationOwner).trim().toLowerCase() : "";
  const stickyTurnsRemainingPrev =
    typeof (state as any).stickyTurnsRemaining === "number" && Number.isFinite((state as any).stickyTurnsRemaining)
      ? Math.max(0, Math.min(4, Math.floor((state as any).stickyTurnsRemaining)))
      : 0;
  const previousDecisionAxis =
    typeof (state as any).lastDecisionAxis === "string" ? String((state as any).lastDecisionAxis).trim() : null;
  const previousDecisionAxisCandidates =
    Array.isArray((state as any).lastDecisionAxisCandidates) ? ((state as any).lastDecisionAxisCandidates as any) : null;

  const axisResolved = resolveDecisionAxisCandidatesFromUserIntent(routingUserMessage, previousDecisionAxisCandidates);
  const decisionAxisCandidates = axisResolved.candidates;
  const decisionAxisSource = axisResolved.source;
  const decisionAxis = decisionAxisCandidates[0]?.axis ?? inferDecisionAxisFromUserIntent(routingUserMessage);

  const explicitOwner = resolveExplicitOwnerFromUserIntent(routingUserMessage);

  // Owner persistence state
  let activeConversationOwner: NextOwner | null =
    activeConversationOwnerRaw === "planner" ||
    activeConversationOwnerRaw === "analyst" ||
    activeConversationOwnerRaw === "architect" ||
    activeConversationOwnerRaw === "designer" ||
    activeConversationOwnerRaw === "security"
      ? (activeConversationOwnerRaw as NextOwner)
      : null;
  let stickyTurnsRemaining = stickyTurnsRemainingPrev;

  const resolvedOwner = resolveNextConversationOwner(phaseOwner, decisionAxisCandidates, momentumWeights);
  let nextOwner = resolvedOwner.owner;
  const ownershipReason = resolvedOwner.reason;
  const ownershipScoreBreakdown = resolvedOwner.breakdown;

  let ownerPersistenceReason: string | null = null;
  const shouldKeepActiveOwner = (): boolean => {
    if (!activeConversationOwner || stickyTurnsRemaining <= 0) return false;
    if (explicitOwner) return false;
    const top = decisionAxisCandidates[0];
    if (top && top.score >= 0.82) {
      const axisOwner = ownerForAxis(top.axis);
      const gap = top.score - Number(decisionAxisCandidates[1]?.score ?? 0);
      if (axisOwner !== activeConversationOwner && gap >= 0.25) return false;
    }
    return true;
  };

  if (explicitOwner) {
    activeConversationOwner = explicitOwner.owner;
    stickyTurnsRemaining = 2;
    nextOwner = explicitOwner.owner;
    ownerPersistenceReason = `explicit_sticky(owner=${explicitOwner.owner},turns=2)`;
  } else if (shouldKeepActiveOwner()) {
    nextOwner = activeConversationOwner!;
    stickyTurnsRemaining = Math.max(0, stickyTurnsRemaining - 1);
    ownerPersistenceReason = `sticky_keep(owner=${nextOwner},remaining=${stickyTurnsRemaining})`;
  } else if (!explicitOwner && activeConversationOwner && stickyTurnsRemaining > 0) {
    ownerPersistenceReason = `sticky_break(owner=${activeConversationOwner},remaining=${stickyTurnsRemaining})`;
    stickyTurnsRemaining = Math.max(0, stickyTurnsRemaining - 1);
  } else {
    if (nextOwner !== "planner") {
      activeConversationOwner = nextOwner;
      stickyTurnsRemaining = 1;
      ownerPersistenceReason = `soft_sticky(owner=${nextOwner},turns=1)`;
    } else {
      activeConversationOwner = null;
      stickyTurnsRemaining = 0;
      ownerPersistenceReason = `no_sticky`;
    }
  }
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
  const ownerLocked =
    typeof ownerPersistenceReason === "string" &&
    (ownerPersistenceReason.startsWith("explicit_sticky") || ownerPersistenceReason.startsWith("sticky_keep"));
  const axisOwner = ownerForAxis(decisionAxis as any);
  const ownerAxisMismatch =
    Boolean(decisionAxis && decisionAxis !== "unknown") &&
    Boolean(nextOwner && nextOwner !== "planner") &&
    axisOwner !== nextOwner;
  if (ownerAxisMismatch) conflictSignals.push(`owner_axis_mismatch(owner=${nextOwner},axis=${decisionAxis})`);
  const conflictDetected =
    Boolean(top1 && top2) &&
    Number(top1?.score ?? 0) >= 0.7 &&
    Number(top2?.score ?? 0) >= 0.66 &&
    ownerForAxis(top1!.axis) !== ownerForAxis(top2!.axis) &&
    Math.abs(Number(top1!.score) - Number(top2!.score)) <= 0.12 &&
    // explicit role mention must win over conflict mediation
    !explicitMentionChosen &&
    // owner persistence must win over conflict mediation
    !ownerLocked;
  if (conflictDetected && top1 && top2) {
    conflictSignals.push(`axis_conflict(${top1.axis}:${top1.score.toFixed(2)} vs ${top2.axis}:${top2.score.toFixed(2)})`);
  }

  // Conflict mediation: 기획자가 중재 역할로 발화한다(리뷰어는 별도 멤버로 노출하지 않음).
  const conversationOwner: NextOwner = conflictDetected ? "planner" : nextOwner;
  const questionGeneratedBy: NextOwner = conversationOwner;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const recentQuestionsPrev = Array.isArray((state as any).recentAssistantQuestions)
    ? ((state as any).recentAssistantQuestions as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];

  const normalizeQuestionForCompare = (q: string): string =>
    String(q ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[?？!.。,]/g, "")
      .trim();

  const isRepeatedQuestion = (candidate: string, recent: readonly string[]): { repeated: boolean; reason?: string } => {
    const c = normalizeQuestionForCompare(candidate);
    if (!c) return { repeated: false };
    for (const prev of recent.slice(0, 6)) {
      const p = normalizeQuestionForCompare(prev);
      if (!p) continue;
      if (c === p) return { repeated: true, reason: "exact_normalized_match" };
      // lightweight containment check (prevents same A vs B being re-asked)
      if (c.length >= 18 && p.length >= 18 && (c.includes(p) || p.includes(c))) return { repeated: true, reason: "contains_match" };
    }
    return { repeated: false };
  };

  // If we're in UX/designer context, ensure we actually update UI-designer slots for answer turns.
  // This is not a scoring redesign: it's a safety net to reflect user choices into slots.
  // Only run on follow-up turns where the previous owner was designer (avoid extra calls on unrelated turns).
  const shouldRunDesignerAnswerMerge =
    Boolean(apiKey) &&
    previousConversationOwner === "designer" &&
    activeConversationOwner === "designer" &&
    (decisionAxis === "ux_direction" || decisionAxis === "mobile_experience");
  if (shouldRunDesignerAnswerMerge) {
    const sp = await runSpecialistGroupTurnOpenAI({
      groupLabel: "feature-designer",
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      referencePromptContextBlock,
      userMessage: userMessageForLlm,
      dialogueExcerpt: input.dialogueExcerpt,
      definitions,
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
      executedAgents.push(...sp.executedRoles.filter((r) => DESIGN_OWNERS.has(r)));
    }
  }

  const buildCoordinatorFallbackProposal = (): string => {
    const pn = input.projectName.trim() || "이 서비스";
    const pd = input.projectDescription.trim();
    const digest = specialistDigest.trim().slice(0, 600);
    const lines: string[] = [`${pn} 방향으로 정리해 보았습니다.`];
    if (pd) lines.push("", `이해한 배경: ${pd.slice(0, 280)}`);
    if (digest) lines.push("", "내부 검토 포인트(요약):", digest);
    lines.push(
      "",
      "예상 흐름(초안):",
      "1. 입력·업로드",
      "2. 자동 처리·가공",
      "3. 검토·수정",
      "4. 확정·공유",
      "",
      "예상 참여 역할(초안):",
      "- 주 작성자",
      "- 협업 참여자",
      "- 관리자",
      "",
      "추천: 검토·수정 단계를 넣는 흐름으로 시작합니다.",
      "다음: 추천안 적용 / 일부 수정 / 다른 대안 보기 중 하나를 골라 주세요."
    );
    return lines.join("\n");
  };
  const buildConflictMediationProposal = (): string => {
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
    const l1 = label(a1);
    const l2 = label(a2);
    return `지금 ${l1}과 ${l2} 두 축이 동시에 중요해 보입니다.

추천 진행(초안):
1. ${l1} 초안을 먼저 맞춤
2. 이어서 ${l2}를 조정

추천: 위 순서로 초안을 잡고 세부를 수정하는 방식입니다.
다음: 추천 순서로 진행 / ${l2} 먼저 / 둘 다 짧게 수정 중 하나를 골라 주세요.`;
  };

  let nextQuestion = conflictDetected ? buildConflictMediationProposal() : buildCoordinatorFallbackProposal();
  let personaValidationReason: string | null = null;
  let personaValidationRetry = 0;
  let repeatedQuestionDetected: boolean | null = null;
  let repeatedQuestionReason: string | null = null;
  let nextQuestionRetryReason: string | null = null;

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
  const skipRepeatGuard = quickActionKind === "alternatives";
  const conflictHint = conflictDetected ? buildConflictMediationProposal() : null;

  const applyCoordinatorMessage = (msg: string, suggestions: string[] | null) => {
    const rep = skipRepeatGuard ? { repeated: false as const } : isRepeatedQuestion(msg, recentQuestionsPrev);
    if (rep.repeated) {
      repeatedQuestionDetected = true;
      repeatedQuestionReason = rep.reason ?? "repeated";
      return false;
    }
    nextQuestion = msg;
    if (suggestions?.length) coordinatorChipSuggestionsRef.current = suggestions;
    return true;
  };

  const stageGroupForProposal =
    state.stageGroup || input.definitions[0]?.stageGroup || SINGLE_CHAT_SERVICE_PLANNING_GROUP;
  const pendingProposalText =
    proposalLifecycle?.pendingProposalPreview?.trim() || recentQuestionsPrev[0]?.trim() || "";
  let proposalApplyFastPath = false;

  const runApplyFastPath = async (): Promise<void> => {
    const snapshot =
      proposalLifecycle?.pendingProposalPreview?.trim() ||
      pendingProposalText ||
      buildCoordinatorFallbackProposal();
    proposalLifecycle = transitionLifecycleOnDecision({
      lifecycle: proposalLifecycle,
      decision: "APPLY",
      stageGroup: stageGroupForProposal,
      acceptedSnapshot: snapshot,
      nowIso: calledAt,
    });
    const nextStage = await runProposalAcceptedNextStageOpenAI({
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      referencePromptContextBlock,
      acceptedProposalSnapshot: snapshot,
      dialogueExcerpt: input.dialogueExcerpt,
      state,
      specialistDigest,
    });
    executedAgents.push("planner-next-stage");
    proposalApplyFastPath = true;
    if (nextStage.ok) {
      promptChunks.push(nextStage.promptText);
      applyCoordinatorMessage(nextStage.assistantMessage, nextStage.suggestions);
      personaValidationReason = "proposal_apply_fast_path";
      return;
    }
    promptChunks.push(`--- planner-next-stage-failed ---\n${nextStage.code}: ${nextStage.message}`);
    applyCoordinatorMessage(
      buildProposalAcceptedNextStageFallback({
        projectName: input.projectName,
        acceptedSnapshot: snapshot,
      }),
      ["세부 요구사항 정리", "기능 상세화", "액터 정의 확장"],
    );
    personaValidationReason = "proposal_apply_fast_path_fallback";
  };

  if (proposalDecision === "APPLY") {
    await runApplyFastPath();
  } else if (apiKey) {
    const synthesis = await runCoordinatorSynthesisTurnOpenAI({
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      referencePromptContextBlock,
      userMessage: userMessageForLlm,
      dialogueExcerpt: input.dialogueExcerpt,
      specialistDigest,
      specialistContributors: uniqSpecialists,
      state,
      decisionAxis,
      conflictHint,
      recentAssistantQuestions: recentQuestionsPrev,
      stickyTurnsRemainingPrev,
      ownerPersistenceReason,
      quickActionLabel,
      quickActionKind,
    });

    if (synthesis.ok) {
      const candidateHash = hashProposalResponse(synthesis.assistantMessage);
      if (
        shouldBlockProposalReplay({
          lifecycle: proposalLifecycle,
          stageGroup: stageGroupForProposal,
          candidateMessageHash: candidateHash,
          proposalDecision,
        })
      ) {
        promptChunks.push(`--- proposal_replay_blocked ---\nhash=${candidateHash}`);
        executedAgents.push("proposal-replay-guard");
        personaValidationReason = "proposal_replay_blocked";
        await runApplyFastPath();
      } else {
        promptChunks.push(synthesis.promptText);
        executedAgents.push("coordinator-synthesis");
        const appliedFirst = applyCoordinatorMessage(synthesis.assistantMessage, synthesis.suggestions);
        if (!appliedFirst) {
          nextQuestionRetryReason = "repeated_question_retry";
          const retry = await runCoordinatorSynthesisTurnOpenAI({
            projectName: input.projectName,
            projectDescription: input.projectDescription,
      referencePromptContextBlock,
            userMessage: `${userMessageForLlm}\n\n[repeat-guard] 직전과 같은 의미로 다시 묻지 말고, proposal-first(예상 흐름·액터 초안)로 다른 세부를 제안하세요.`,
            synthesisRetryHint:
              "직전 출력이 반복·question-first였을 수 있음. 예상 흐름·액터 초안을 갱신하고 수정·선택만 요청.",
            dialogueExcerpt: input.dialogueExcerpt,
            specialistDigest,
            specialistContributors: uniqSpecialists,
            state,
            decisionAxis,
            conflictHint,
            recentAssistantQuestions: recentQuestionsPrev,
            stickyTurnsRemainingPrev,
            ownerPersistenceReason,
            quickActionLabel,
            quickActionKind,
          });
          if (retry.ok) {
            promptChunks.push(retry.promptText);
            executedAgents.push("coordinator-synthesis:repeat-guard");
            if (applyCoordinatorMessage(retry.assistantMessage, retry.suggestions)) {
              nextQuestionRetryReason = "repeated_question_retry_succeeded";
              if (shouldRegisterPendingProposal(retry.assistantMessage)) {
                proposalLifecycle = transitionLifecycleOnPendingProposal({
                  lifecycle: proposalLifecycle,
                  stageGroup: stageGroupForProposal,
                  proposalMessage: retry.assistantMessage,
                  nowIso: calledAt,
                });
              }
            } else {
              nextQuestionRetryReason = "repeated_question_retry_failed";
            }
          }
        } else if (shouldRegisterPendingProposal(synthesis.assistantMessage)) {
          proposalLifecycle = transitionLifecycleOnPendingProposal({
            lifecycle: proposalLifecycle,
            stageGroup: stageGroupForProposal,
            proposalMessage: synthesis.assistantMessage,
            nowIso: calledAt,
          });
        }

        if (proposalDecision) {
          proposalLifecycle = transitionLifecycleOnDecision({
            lifecycle: proposalLifecycle,
            decision: proposalDecision,
            stageGroup: stageGroupForProposal,
            acceptedSnapshot: pendingProposalText || synthesis.assistantMessage,
            nowIso: calledAt,
          });
        }
      }
    } else {
      personaValidationReason = `coordinator_synthesis_failed:${synthesis.code}`;
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

  const updatedSlotKeys = uniqueStrings(allUpdated);

  const meta: SingleChatOrchestrationTurnMeta = {
    routingDecision: proposalApplyFastPath
      ? "proposal_apply_fast_path"
      : `orchestration_turn(${conversationOwner})`,
    matchedSlots: route.matchedSlots,
    updatedSlotKeys,
    updatedSlotCount: updatedSlotKeys.length,
    delegatedAgents: uniqSpecialists,
    /** 사용자 UI에는 항상 AI 기획자(코디네이터) 단일 화자 */
    orchestratorAgent: "planner",
    nextQuestionOwnerAgent: conversationOwner,
    conversationOwner,
    questionGeneratedBy,
    ownershipReason,
    decisionAxis,
    ...(previousConversationOwner ? { previousConversationOwner } : {}),
    ...(activeConversationOwner ? { activeConversationOwner } : {}),
    ...(typeof stickyTurnsRemaining === "number" ? { stickyTurnsRemaining } : {}),
    ...(ownerPersistenceReason ? { ownerPersistenceReason } : {}),
    ...(previousDecisionAxis ? { previousDecisionAxis } : {}),
    ...(typeof decisionAxisSource === "string" ? { decisionAxisSource } : {}),
    ...(typeof ownerAxisMismatch === "boolean" ? { ownerAxisMismatch } : {}),
    ...(typeof repeatedQuestionDetected === "boolean" ? { repeatedQuestionDetected } : {}),
    ...(repeatedQuestionReason ? { repeatedQuestionReason } : {}),
    ...(nextQuestionRetryReason ? { nextQuestionRetryReason } : {}),
    ...(coordinatorChipSuggestionsRef.current?.length
      ? { interviewSuggestions: coordinatorChipSuggestionsRef.current as readonly string[] }
      : {}),
    ...(quickActionLabel ? { quickActionLabel: quickActionLabel.slice(0, 40) } : {}),
    ...(quickActionKind ? { quickActionKind } : {}),
    ...(proposalDecision ? { proposalDecision } : {}),
    ...(proposalLifecycle ? { proposalLifecyclePhase: proposalLifecycle.phase } : {}),
    ...(proposalApplyFastPath ? { proposalApplyFastPath: true } : {}),
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
      lastConversationOwner: conversationOwner,
      activeConversationOwner: activeConversationOwner ?? null,
      stickyTurnsRemaining,
      lastDelegatedAgents: uniqSpecialists,
      lastRoutingDecision: `orchestration_turn(${conversationOwner})`,
      ownerMomentum: ownerMomentumNext,
      lastDecisionAxis: decisionAxis,
      lastDecisionAxisCandidates: decisionAxisCandidates.map((c) => ({ axis: c.axis, score: c.score })),
      recentAssistantQuestions: [nextQuestion, ...recentQuestionsPrev].filter(Boolean).slice(0, 8),
      proposalLifecycleV1: proposalLifecycle,
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
  readonly quickActionLabel?: string | null;
}): SingleChatOrchestrationTurnOk {
  const rawUm = String(input.userMessage ?? "").trim();
  const qaLabel = String(input.quickActionLabel ?? "").trim() || null;
  const qaKind = classifyQuickAction(qaLabel);
  const heur = routingUserMessageForHeuristics(rawUm, qaLabel);
  const um = heur;
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

  const baseMsg = explicitOwner ? roleFallbackQuestion(explicitOwner) : patches.length === 0
    ? "말씀해 주신 내용을 바탕으로 조금만 더 구체화하고 싶습니다. 가장 먼저 해결하려는 사용자의 문제를 한 문장으로 알려주실 수 있을까요?"
    : `좋습니다. 현재 답변을 반영해 필요한 정보를 정리했습니다.\n\n한 가지만 더 알려주세요. 지금 단계에서 가장 불확실한 부분은 무엇인가요?`;
  const prefix =
    qaKind === "apply"
      ? "선택하신 내용을 반영하는 방향으로 이어가겠습니다.\n\n"
      : qaKind === "alternatives"
        ? "다른 대안을 같은 관점에서 다시 정리했습니다.\n\n"
        : qaKind === "partial_edit"
          ? "추천안을 기준으로 일부만 조정하면 됩니다.\n\n"
          : qaKind === "defer"
            ? "보류하신 부분은 나중으로 미루고,\n\n"
            : "";
  const msg = `${prefix}${baseMsg}`.trim();

  const buckets = slotBucketsByStatus(nextState);

  const updatedSlotKeys = uniqueOrchestrationUpdatedSlotKeys(patches);

  const meta: SingleChatOrchestrationTurnMeta = {
    routingDecision,
    matchedSlots: matched,
    updatedSlotKeys,
    updatedSlotCount: updatedSlotKeys.length,
    delegatedAgents: [],
    orchestratorAgent: explicitOwner ?? "planner",
    conversationOwner: explicitOwner ?? "planner",
    questionGeneratedBy: explicitOwner ?? "planner",
    ownershipReason: explicitOwner ? "explicit_role_mention(fallback)" : "fallback_no_llm",
    ...(qaLabel ? { quickActionLabel: qaLabel.slice(0, 40) } : {}),
    ...(qaKind ? { quickActionKind: qaKind } : {}),
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
