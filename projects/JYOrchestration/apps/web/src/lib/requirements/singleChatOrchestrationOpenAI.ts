import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import { mergeOrchestrationSlotPatches } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { SingleChatSelectedAgentWire } from "@/lib/requirements/singleChatAgentContext";

export type SingleChatOrchestrationTurnMeta = Readonly<{
  routingDecision: string;
  matchedSlots: readonly string[];
  updatedSlotKeys: readonly string[];
  delegatedAgents: readonly string[];
  orchestratorAgent: string;
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

function filterDelegatesForActiveRoles(
  delegated: readonly string[],
  active: Set<string>
): string[] {
  return delegated.filter((d) => active.has(String(d).trim().toLowerCase()));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * 휴리스틱 오케스트레이션 — OpenAI 실패 시 슬롯·routing 메타는 유지하고 단일 응답만 생성.
 */
export function runSingleChatOrchestrationFallbackTurn(input: {
  readonly userMessage: string;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly baseState: RequirementsSingleChatOrchestrationStateV1;
  readonly activeRoles: Set<string>;
  readonly nowIso: string;
}): SingleChatOrchestrationTurnOk {
  const um = input.userMessage.trim();
  const patches: { slotKey: string; status: string; value: string; confidence: number; ownerAgent?: string }[] = [];
  const matched: string[] = [];
  const delegated = new Set<string>();

  const bump = (
    slotKey: string,
    owner: string,
    fragment: string,
    conf: number,
    delegateRole: string
  ): void => {
    if (!input.activeRoles.has(delegateRole)) return;
    patches.push({ slotKey, status: um.length > 80 ? "completed" : "partial", value: fragment, confidence: conf, ownerAgent: owner });
    matched.push(slotKey);
    delegated.add(delegateRole);
  };

  const lower = um.toLowerCase();
  const defByOwner = (role: string) => input.definitions.filter((d) => d.ownerAgent === role);

  if (/관리자|admin|운영자/.test(um)) {
    const d = defByOwner("service-designer").find((x) => x.slotKey.includes("actors"));
    if (d) bump(d.slotKey, d.ownerAgent, "관리자 액터 언급", 0.55, "service-designer");
  }
  if (/일반\s*사용자|고객|이용자|user/.test(lower)) {
    const d = defByOwner("service-designer").find((x) => x.slotKey.includes("actors"));
    if (d && !matched.includes(d.slotKey)) bump(d.slotKey, d.ownerAgent, "일반 사용자 액터 언급", 0.55, "service-designer");
  }
  if (/예약|booking|reservation/.test(lower)) {
    const flow = defByOwner("service-designer").find((x) => x.slotKey.includes("userJourney"));
    if (flow) bump(flow.slotKey, flow.ownerAgent, "예약 관련 흐름 언급", 0.5, "service-designer");
    const feat = defByOwner("spec-reviewer").find((x) => x.slotKey.includes("featureList"));
    if (feat) bump(feat.slotKey, feat.ownerAgent, "예약 기능 언급", 0.5, "spec-reviewer");
  }
  if (/화면|UI|페이지/.test(um)) {
    const d = defByOwner("spec-reviewer").find((x) => x.slotKey.includes("screens"));
    if (d) bump(d.slotKey, d.ownerAgent, "화면/UI 언급", 0.45, "spec-reviewer");
  }
  if (/우선|priority|mvp|필수\s*기능/.test(lower)) {
    const d = defByOwner("task-reviewer").find((x) => x.slotKey.includes("priority"));
    if (d) bump(d.slotKey, d.ownerAgent, "우선순위/MVP 언급", 0.45, "task-reviewer");
  }
  if (/목적|만들고\s*싶|서비스\s*아이디어|무엇을/.test(um)) {
    const d = defByOwner("planner").find((x) => x.slotKey.includes("servicePurpose"));
    if (d) bump(d.slotKey, d.ownerAgent, um.slice(0, 400), 0.5, "planner");
  }

  const nextState = mergeOrchestrationSlotPatches({
    base: input.baseState,
    patches,
    nowIso: input.nowIso,
  });

  const delegatedList = filterDelegatesForActiveRoles([...delegated], input.activeRoles);

  const routingDecision =
    patches.length === 0
      ? "E: 슬롯 미충족 — 후속 질문 필요 (fallback)"
      : delegatedList.length > 1
        ? `D: 다중 슬롯 동시 반영 (fallback) — ${delegatedList.join(",")}`
        : delegatedList.length === 1
          ? `B/C: 역할 슬롯 보강 (fallback) — ${delegatedList[0]}`
          : "A: planner 영역 추정 (fallback)";

  const msg =
    patches.length === 0
      ? "말씀해 주신 내용을 바탕으로 조금만 더 구체화하고 싶습니다. 가장 먼저 해결하려는 사용자의 문제를 한 문장으로 알려주실 수 있을까요?"
      : `좋습니다. 현재 답변을 반영해 필요한 정보를 정리했습니다.\n\n한 가지만 더 알려주세요. 지금 단계에서 가장 불확실한 부분은 무엇인가요?`;

  const meta: SingleChatOrchestrationTurnMeta = {
    routingDecision,
    matchedSlots: matched,
    updatedSlotKeys: patches.map((p) => p.slotKey),
    delegatedAgents: delegatedList,
    orchestratorAgent: "planner",
  };

  return {
    ok: true,
    assistantMessage: msg,
    nextState: {
      ...nextState,
      lastOrchestratorAgent: "planner",
      lastDelegatedAgents: delegatedList,
      lastRoutingDecision: routingDecision,
    },
    meta,
    promptText: "[orchestration:fallback_heuristic]",
    model: "fallback",
    provider: "fallback",
    calledAt: input.nowIso,
  };
}

export async function runSingleChatOrchestrationTurnOpenAI(input: {
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
  readonly responseStyle?: "brief" | "standard" | "detailed";
}): Promise<SingleChatOrchestrationTurnResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }

  const model = resolveOpenAiModelFromEnv();
  const nowIso = new Date().toISOString();

  const excerpt = input.dialogueExcerpt.trim().slice(0, 18_000);
  const catalogJson = JSON.stringify(
    input.definitions.map((d) => ({
      slotKey: d.slotKey,
      label: d.label,
      ownerAgent: d.ownerAgent,
      stageGroup: d.stageGroup,
    })),
    null,
    0
  ).slice(0, 24_000);

  const slotsJson = JSON.stringify(input.baseState.slots, null, 0).slice(0, 24_000);
  const rolesLine = [...input.activeRoles].join(", ") || "(역할 미설정 — 문맥만으로 추론)";

  const agentInsert = (input.participatingAgentsPromptBlock ?? "").trim()
    ? `\n\n${(input.participatingAgentsPromptBlock ?? "").trim()}\n`
    : "";

  const mentionBlock = (input.mentionTargetsSummary ?? "").trim()
    ? `\n\n[질문 대상 멤버]\n${(input.mentionTargetsSummary ?? "").trim()}`
    : "";
  const senderBlock = (input.senderSummary ?? "").trim()
    ? `\n\n[발신]\n${(input.senderSummary ?? "").trim()}`
    : "";
  const handoffBlock = (input.priorScreenHandoff ?? "").trim()
    ? `\n\n[이전 화면에서 넘어온 맥락]\n${(input.priorScreenHandoff ?? "").trim().slice(0, 4000)}`
    : "";

  const system = `${workspaceAiMemberSystemPrefix("ideation")}${agentInsert}
당신은 SingleChat 내부 오케스트레이션 엔진입니다. 사용자에게는 절대 "여러 AI가 있다"고 말하지 마세요.
표면 역할: AI기획자(planner) 하나가 대화하는 것처럼 자연스러운 한국어 단일 응답을 만듭니다.

내부 규칙:
1) planner가 사용자 입력을 1차 분석합니다.
2) 액터·흐름·예외·시나리오는 service-designer / domain-expert 담당 슬롯으로만 채웁니다.
3) 기능·우선순위·화면·프로토 범위는 spec-reviewer / task-reviewer 담당 슬롯으로만 채웁니다.
4) 프로젝트에 실제로 활성화된 역할(activeRoles)만 delegatedAgents에 넣습니다. 없는 역할은 가정하지 마세요.
5) 응답 assistantMessage는 한 번에 하나의 확인 질문만 포함합니다(문장 끝 물음표는 원칙적으로 1개).
6) 반드시 유효한 JSON 한 개만 출력합니다. 마크다운·코드펜스 금지.

출력 스키마:
{
  "assistantMessage": "사용자에게 보이는 단일 응답(한국어)",
  "routingDecision": "A|B|C|D|E 와 짧은 한국어 설명",
  "matchedSlots": ["slotKey", ...],
  "delegatedAgents": ["service-designer", ...],
  "orchestratorAgent": "planner",
  "updatedSlots": [
    { "slotKey": "...", "status": "empty|partial|completed", "value": "근거 한 줄", "confidence": 0.0, "ownerAgent": "planner|service-designer|domain-expert|spec-reviewer|task-reviewer" }
  ]
}

판단 코드 힌트(내부):
- A: planner 슬롯 중심
- B: 분석가(service-designer/domain-expert) 슬롯
- C: 설계자(spec-reviewer/task-reviewer) 슬롯
- D: 복합
- E: 미충족 → 후속 질문
`;

  const user = `[프로젝트]
이름: ${input.projectName.trim() || "(이름 없음)"}
설명: ${input.projectDescription.trim() || "(설명 없음)"}
유형: ${String(input.projectType ?? "").trim() || "(미지정)"}
${handoffBlock}

[활성 오케스트레이션 역할(aiOrchestrationRole)]
${rolesLine}

[슬롯 정의]
${catalogJson}

[현재 슬롯 상태]
${slotsJson}

[최근 대화 발췌]
${excerpt || "(없음)"}

[사용자 최신 발화]
${input.userMessage.trim()}${mentionBlock}${senderBlock}

출력은 JSON 한 개만.`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.28,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message.slice(0, 400) };
  }

  const text = res.text?.trim() ?? "";
  if (!text) {
    return { ok: false, code: "EMPTY", message: "응답 본문이 비어 있습니다." };
  }

  const parsed = safeJsonParse(text) as Record<string, unknown> | null;
  if (!parsed) {
    return { ok: false, code: "PARSE", message: "JSON 파싱 실패" };
  }

  const assistantMessage = String(parsed.assistantMessage ?? "").trim();
  if (!assistantMessage) {
    return { ok: false, code: "SCHEMA", message: "assistantMessage 없음" };
  }

  const routingDecision = String(parsed.routingDecision ?? "routing_unknown").trim().slice(0, 500);
  const matchedSlots = Array.isArray(parsed.matchedSlots)
    ? parsed.matchedSlots.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  let delegatedAgents = Array.isArray(parsed.delegatedAgents)
    ? parsed.delegatedAgents.map((x) => String(x ?? "").trim().toLowerCase()).filter(Boolean)
    : [];

  delegatedAgents = filterDelegatesForActiveRoles(delegatedAgents, input.activeRoles);

  const orchestratorAgent = String(parsed.orchestratorAgent ?? "planner").trim().slice(0, 64) || "planner";

  const updatedSlotsRaw = Array.isArray(parsed.updatedSlots) ? parsed.updatedSlots : [];
  const patches: {
    slotKey: string;
    status?: string;
    value?: string | null;
    confidence?: number | null;
    ownerAgent?: string;
  }[] = [];

  for (const row of updatedSlotsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const slotKey = String(r.slotKey ?? "").trim();
    if (!slotKey || !input.baseState.slots[slotKey]) continue;
    const ownerRaw = String(r.ownerAgent ?? "").trim().toLowerCase();
    if (ownerRaw && !input.activeRoles.has(ownerRaw)) {
      const slotDef = input.definitions.find((d) => d.slotKey === slotKey);
      const canonicalOwner = slotDef?.ownerAgent ?? "";
      if (!canonicalOwner || !input.activeRoles.has(canonicalOwner)) continue;
    }
    patches.push({
      slotKey,
      status: String(r.status ?? ""),
      value: r.value === null || r.value === undefined ? null : String(r.value).slice(0, 4000),
      confidence: r.confidence === null || r.confidence === undefined ? null : Number(r.confidence),
      ownerAgent: String(r.ownerAgent ?? "").trim() || undefined,
    });
  }

  const nextStateBase = mergeOrchestrationSlotPatches({
    base: input.baseState,
    patches,
    nowIso,
  });

  const updatedSlotKeys = patches.map((p) => p.slotKey);

  const meta: SingleChatOrchestrationTurnMeta = {
    routingDecision,
    matchedSlots,
    updatedSlotKeys,
    delegatedAgents,
    orchestratorAgent,
  };

  const promptText = `[system]\n${system}\n\n---\n\n[user]\n${user}`;

  return {
    ok: true,
    assistantMessage,
    nextState: {
      ...nextStateBase,
      lastOrchestratorAgent: orchestratorAgent,
      lastDelegatedAgents: delegatedAgents,
      lastRoutingDecision: routingDecision,
    },
    meta,
    promptText,
    model,
    provider: "openai",
    calledAt: nowIso,
  };
}
