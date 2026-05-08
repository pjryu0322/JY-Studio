import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatDynamicSlotProposalWireV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import {
  plannerSlotKeys,
  stringifyPlannerRouteSlotCatalogForLlm,
  type SlotExpansionPhase,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { filterDelegatesForActiveRoles, parseUpdatedSlotsRows, safeJsonParse } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";

export type PlannerRouteTurnOk = Readonly<{
  ok: true;
  routingDecision: string;
  delegatedAgents: string[];
  matchedSlots: string[];
  patches: SlotPatchInput[];
  /** Hybrid: LLM이 제안한 동적 슬롯(검증 전, 외부 owner 네임스페이스) */
  suggestedSlots?: readonly SingleChatDynamicSlotProposalWireV1[];
  promptText: string;
  model: string;
}>;
export type PlannerRouteTurnErr = Readonly<{ ok: false; code: string; message: string }>;
export type PlannerRouteTurnResult = PlannerRouteTurnOk | PlannerRouteTurnErr;

/** 1단계: 라우팅 + planner 슬롯만 갱신(JSON). */
export async function runPlannerRouteTurnOpenAI(input: {
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
  /** 슬롯 정의 JSON 범위·dependsOn 포함 여부. 미지정 시 3(전체). */
  readonly slotExpansionPhase?: SlotExpansionPhase;
}): Promise<PlannerRouteTurnResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };

  const model = resolveOpenAiModelFromEnv();
  const plannerKeys = new Set(plannerSlotKeys(input.definitions));
  const allKeys = new Set(input.definitions.map((d) => d.slotKey));
  const excerpt = input.dialogueExcerpt.trim().slice(0, 14_000);
  const expansionPhase: SlotExpansionPhase = input.slotExpansionPhase ?? 3;
  const catalogJson = stringifyPlannerRouteSlotCatalogForLlm(input.definitions, expansionPhase);

  const slotsJson = JSON.stringify(input.baseState.slots, null, 0).slice(0, 20_000);
  const rolesLine = [...input.activeRoles].join(", ");

  const agentInsert = (input.participatingAgentsPromptBlock ?? "").trim()
    ? `\n${(input.participatingAgentsPromptBlock ?? "").trim()}\n`
    : "";

  const mentionBlock = (input.mentionTargetsSummary ?? "").trim()
    ? `\n[질문 대상 멤버]\n${(input.mentionTargetsSummary ?? "").trim()}`
    : "";
  const senderBlock = (input.senderSummary ?? "").trim() ? `\n[발신]\n${(input.senderSummary ?? "").trim()}` : "";
  const handoffBlock = (input.priorScreenHandoff ?? "").trim()
    ? `\n[이전 화면 맥락]\n${(input.priorScreenHandoff ?? "").trim().slice(0, 3000)}`
    : "";

  const system = `${workspaceAiMemberSystemPrefix("ideation")}${agentInsert}
당신은 SingleChat 내부 **planner 라우터**입니다. 사용자에게 직접 말하지 않습니다. JSON만 출력.

[슬롯 카탈로그 범위] expansionPhase=${expansionPhase} (1=planning, 2=+flow, 3=전체). [슬롯 정의]는 이 범위만 포함할 수 있으나, updatedSlots의 slotKey는 반드시 [현재 슬롯]에 존재하는 전체 키와 일치해야 한다.

역할:
1) 사용자 발화를 분석해 planner 소유 슬롯만 갱신(updatedSlots의 owner는 planner만).
2) 액터·흐름·시나리오가 핵심이면 delegatedAgents에 "service-designer" 또는 "domain-expert"를 넣습니다(활성 역할만).
3) 기능·우선순위·화면·프로토 범위가 핵심이면 "solution-architect" 또는 "task-reviewer"를 넣습니다(활성만).
4) 보안·프라이버시·인증/권한이 핵심이면 "security-reviewer"를 넣습니다(활성만).
5) planner 슬롯만 다루면 delegatedAgents는 빈 배열 [].
6) 복합이면 필요한 역할만 나열. 절대 불필요한 역할을 넣지 마세요.
7) "planner" 문자열은 delegatedAgents에 넣지 마세요.

출력 JSON 스키마:
{
  "routingDecision": "A~E 코드와 한국어 한 줄",
  "matchedSlots": ["slotKey"],
  "delegatedAgents": ["service-designer", ...],
  "suggestedSlots": [
    {
      "slotKey": "dyn_meetingApprovalFlow",
      "title": "회의 승인 흐름",
      "description": "회의록 승인/검수 프로세스",
      "ownerAgent": "security|designer|analyst|architect|reviewer|planner",
      "reason": "왜 필요한지 한 줄",
      "priority": "high|medium|low",
      "proposalConfidence": 0.0
    }
  ],
  "updatedSlots": [
    { "slotKey": "...", "status": "empty|partial|candidate|confirmed|stale", "value": "...", "confidence": 0.0, "ownerAgent": "planner" }
  ]
}`;

  const user = `[프로젝트] ${input.projectName.trim()} / ${input.projectDescription.trim().slice(0, 600)}
유형: ${String(input.projectType ?? "").trim() || "—"}${handoffBlock}
[활성 역할] ${rolesLine}
[슬롯 정의] ${catalogJson}
[현재 슬롯] ${slotsJson}
[대화 발췌] ${excerpt || "—"}
[사용자 발화] ${input.userMessage.trim()}${mentionBlock}${senderBlock}`;

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
  if (!text) return { ok: false, code: "EMPTY", message: "planner-route 응답 비어 있음" };

  const parsed = safeJsonParse(text) as Record<string, unknown> | null;
  if (!parsed) return { ok: false, code: "PARSE", message: "planner-route JSON 실패" };

  const routingDecision = String(parsed.routingDecision ?? "").trim().slice(0, 500) || "routing_unknown";
  const matchedSlots = Array.isArray(parsed.matchedSlots)
    ? parsed.matchedSlots.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];

  let delegated = Array.isArray(parsed.delegatedAgents)
    ? parsed.delegatedAgents.map((x) => String(x ?? "").trim().toLowerCase()).filter(Boolean)
    : [];
  delegated = filterDelegatesForActiveRoles(delegated, input.activeRoles);

  const rawSlots = parseUpdatedSlotsRows(parsed.updatedSlots, allKeys, new Set(["planner"]), input.definitions);
  const patches = rawSlots.filter((p) => plannerKeys.has(p.slotKey));

  const rawSuggested = Array.isArray(parsed.suggestedSlots) ? parsed.suggestedSlots : [];
  const suggestedSlots: PlannerRouteTurnOk["suggestedSlots"] = rawSuggested
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
        priorityRaw === "high" || priorityRaw === "medium" || priorityRaw === "low"
          ? (priorityRaw as "high" | "medium" | "low")
          : null;
      const proposalConfidence =
        r.proposalConfidence !== null && r.proposalConfidence !== undefined && Number.isFinite(Number(r.proposalConfidence))
          ? Math.min(1, Math.max(0, Number(r.proposalConfidence)))
          : null;
      const reason = typeof r.reason === "string" ? r.reason.slice(0, 200) : r.reason === null ? null : null;
      return { slotKey, title, description, ownerAgent, reason, priority, proposalConfidence };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const promptText = `[planner-route]\n[system]\n${system}\n\n[user]\n${user}`;

  return {
    ok: true,
    routingDecision,
    delegatedAgents: delegated,
    matchedSlots,
    patches,
    ...(suggestedSlots.length ? { suggestedSlots } : {}),
    promptText,
    model,
  };
}

