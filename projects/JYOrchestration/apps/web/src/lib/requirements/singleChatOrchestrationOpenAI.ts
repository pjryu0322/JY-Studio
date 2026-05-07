import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import {
  isPlannerStableEnough,
  mergeOrchestrationSlotPatches,
  plannerSlotKeys,
  slotBucketsByStatus,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type { SingleChatSelectedAgentWire } from "@/lib/requirements/singleChatAgentContext";

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

function filterDelegatesForActiveRoles(delegated: readonly string[], active: Set<string>): string[] {
  return delegated
    .map((d) => String(d ?? "").trim().toLowerCase())
    .filter((d) => d && d !== "planner" && active.has(d));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function parseUpdatedSlotsRows(
  raw: unknown,
  validKeys: Set<string>,
  allowedOwners: Set<string> | null,
  definitions: readonly SingleChatOrchestrationSlotDefinition[]
): SlotPatchInput[] {
  if (!Array.isArray(raw)) return [];
  const defOwner = new Map(definitions.map((d) => [d.slotKey, d.ownerAgent]));
  const out: SlotPatchInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const slotKey = String(r.slotKey ?? "").trim();
    if (!slotKey || !validKeys.has(slotKey)) continue;
    const canonical = defOwner.get(slotKey) ?? "";
    if (allowedOwners && !allowedOwners.has(canonical)) continue;
    const ownerRaw = String(r.ownerAgent ?? "").trim().toLowerCase();
    if (ownerRaw && ownerRaw !== canonical && canonical) continue;
    out.push({
      slotKey,
      status: String(r.status ?? ""),
      value: r.value === null || r.value === undefined ? null : String(r.value).slice(0, 4000),
      confidence: r.confidence === null || r.confidence === undefined ? null : Number(r.confidence),
      ownerAgent: canonical || undefined,
    });
  }
  return out;
}

const FLOW_OWNERS = new Set(["service-designer", "domain-expert"]);
const DESIGN_OWNERS = new Set(["spec-reviewer", "task-reviewer"]);

/** 1단계: 라우팅 + planner 슬롯만 갱신(JSON). 사용자 메시지 없음. */
async function runPlannerRouteTurnOpenAI(input: {
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
}): Promise<
  | Readonly<{
      ok: true;
      routingDecision: string;
      delegatedAgents: string[];
      matchedSlots: string[];
      patches: SlotPatchInput[];
      promptText: string;
      model: string;
    }>
  | Readonly<{ ok: false; code: string; message: string }>
> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };

  const model = resolveOpenAiModelFromEnv();
  const plannerKeys = new Set(plannerSlotKeys(input.definitions));
  const allKeys = new Set(input.definitions.map((d) => d.slotKey));
  const excerpt = input.dialogueExcerpt.trim().slice(0, 14_000);
  const catalogJson = JSON.stringify(
    input.definitions.map((d) => ({
      slotKey: d.slotKey,
      label: d.label,
      ownerAgent: d.ownerAgent,
      dependsOn: d.dependsOn ?? [],
    })),
    null,
    0
  ).slice(0, 20_000);

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

역할:
1) 사용자 발화를 분석해 planner 소유 슬롯만 갱신(updatedSlots의 owner는 planner만).
2) 액터·흐름·시나리오가 핵심이면 delegatedAgents에 "service-designer" 또는 "domain-expert"를 넣습니다(활성 역할만).
3) 기능·우선순위·화면·프로토 범위가 핵심이면 "spec-reviewer" 또는 "task-reviewer"를 넣습니다(활성만).
4) planner 슬롯만 다루면 delegatedAgents는 빈 배열 [].
5) 복합이면 필요한 역할만 나열. 절대 불필요한 역할을 넣지 마세요.
6) "planner" 문자열은 delegatedAgents에 넣지 마세요.

출력 JSON 스키마:
{
  "routingDecision": "A~E 코드와 한국어 한 줄",
  "matchedSlots": ["slotKey"],
  "delegatedAgents": ["service-designer", ...],
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

  const promptText = `[planner-route]\n[system]\n${system}\n\n[user]\n${user}`;

  return {
    ok: true,
    routingDecision,
    delegatedAgents: delegated,
    matchedSlots,
    patches,
    promptText,
    model,
  };
}

async function runSpecialistGroupTurnOpenAI(input: {
  readonly groupLabel: "flow-analyst" | "feature-designer";
  readonly projectName: string;
  readonly projectDescription: string;
  readonly userMessage: string;
  readonly dialogueExcerpt: string;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly state: RequirementsSingleChatOrchestrationStateV1;
  readonly participatingAgentsPromptBlock: string;
  readonly activeRoles: Set<string>;
  readonly allowedOwners: Set<string>;
}): Promise<
  Readonly<{
    ok: boolean;
    patches: SlotPatchInput[];
    promptText: string;
    executedRoles: string[];
  }>
> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, patches: [], promptText: "[specialist:skip_no_key]", executedRoles: [] };
  }

  const model = resolveOpenAiModelFromEnv();
  const allKeys = new Set(input.definitions.map((d) => d.slotKey));
  const targetDefs = input.definitions.filter((d) => input.allowedOwners.has(d.ownerAgent));
  if (!targetDefs.length) {
    return { ok: true, patches: [], promptText: "[specialist:skip_no_defs]", executedRoles: [] };
  }

  const slotsJson = JSON.stringify(input.state.slots, null, 0).slice(0, 18_000);
  const targetCatalog = JSON.stringify(
    targetDefs.map((d) => ({ slotKey: d.slotKey, label: d.label, ownerAgent: d.ownerAgent, dependsOn: d.dependsOn ?? [] })),
    null,
    0
  );

  const persona =
    input.groupLabel === "flow-analyst"
      ? "service-designer 및 domain-expert — 액터·흐름·예외·시나리오 슬롯만 다룹니다."
      : "spec-reviewer 및 task-reviewer — 기능·우선순위·화면·프로토 범위 슬롯만 다룹니다.";

  const system = `${workspaceAiMemberSystemPrefix("ideation")}
당신은 SingleChat 내부 **${persona}**
사용자에게 직접 말하지 않습니다. JSON만 출력.
규칙:
- 오직 위 목록의 슬롯만 updatedSlots에 포함.
- status는 반드시 "candidate" (planner 확정 전). 값·근거를 value에 한국어로 짧게.
- planner 슬롯은 수정 금지.

출력: { "updatedSlots": [ { "slotKey", "status": "candidate", "value", "confidence", "ownerAgent" } ] }`;

  const user = `[프로젝트] ${input.projectName.trim()}
[대화 발췌] ${input.dialogueExcerpt.trim().slice(0, 8000)}
[사용자] ${input.userMessage.trim()}
[대상 슬롯] ${targetCatalog}
[현재 상태] ${slotsJson}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.25,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return {
      ok: false,
      patches: [],
      promptText: `[specialist:${input.groupLabel}:fail:${res.code}]`,
      executedRoles: [],
    };
  }

  const parsed = safeJsonParse(res.text ?? "") as Record<string, unknown> | null;
  const rawPatches = parseUpdatedSlotsRows(parsed?.updatedSlots, allKeys, input.allowedOwners, input.definitions);
  const patches: SlotPatchInput[] = rawPatches.map((p) => ({
    ...p,
    status: "candidate",
    derivedFrom: `specialist:${input.groupLabel}`,
    staleReason: null,
  }));

  const defByKey = new Map(input.definitions.map((d) => [d.slotKey, d]));
  const executedRoles = [
    ...new Set(
      patches
        .map((p) => defByKey.get(p.slotKey)?.ownerAgent ?? "")
        .filter((o) => o && input.activeRoles.has(o) && input.allowedOwners.has(o))
    ),
  ];

  return {
    ok: true,
    patches,
    promptText: `[specialist:${input.groupLabel}]\n[system]\n${system}\n\n[user]\n${user}`,
    executedRoles,
  };
}

async function runPlannerMergeTurnOpenAI(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly userMessage: string;
  readonly dialogueExcerpt: string;
  readonly state: RequirementsSingleChatOrchestrationStateV1;
  readonly specialistDigest: string;
  readonly plannerStable: boolean;
  readonly participatingAgentsPromptBlock: string;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): Promise<
  | Readonly<{ ok: true; assistantMessage: string; patches: SlotPatchInput[]; promptText: string; model: string }>
  | Readonly<{ ok: false; code: string; message: string }>
> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "NO_KEY", message: "NO_KEY" };

  const model = resolveOpenAiModelFromEnv();
  const allKeys = new Set(input.definitions.map((d) => d.slotKey));
  const slotsJson = JSON.stringify(input.state.slots, null, 0).slice(0, 18_000);

  const agentInsert = (input.participatingAgentsPromptBlock ?? "").trim()
    ? `\n${input.participatingAgentsPromptBlock.trim()}\n`
    : "";

  const stableLine = input.plannerStable
    ? "planner 슬롯이 충분히 안정화됨 → 후보(candidate) 슬롯 중 일부를 confirmed로 올릴 수 있음(신중히)."
    : "planner 미안정 → 후보 슬롯은 confirmed 금지. planner 슬롯만 partial/confirmed 조정 가능.";

  const system = `${workspaceAiMemberSystemPrefix("ideation")}${agentInsert}
당신은 **planner**입니다. 사용자에게 보이는 **단일 한국어 응답** assistantMessage 한 개를 만듭니다.
내부 분석가/설계자의 후보는 사용자에게 노출하지 말고 자연스럽게 통합하세요. "여러 AI" 언급 금지.
확인 질문은 원칙적으로 1개만.

${stableLine}

추가 JSON 필드:
- plannerSlotAdjustments: planner 소유 슬롯만 { slotKey, status, value?, confidence? }
- derivedPromotions: (planner 안정 시만) 비-planner 슬롯을 confirmed로 승격할 slotKey 배열

출력 JSON:
{
  "assistantMessage": "...",
  "plannerSlotAdjustments": [...],
  "derivedPromotions": ["slotKey"]
}`;

  const user = `[프로젝트] ${input.projectName}
[사용자] ${input.userMessage.trim()}
[발췌] ${input.dialogueExcerpt.trim().slice(0, 6000)}
[전문가 요약(내부)] ${input.specialistDigest.slice(0, 4000) || "(없음)"}
[슬롯 스냅샷] ${slotsJson}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.32,
    responseFormatJsonObject: true,
  });

  if (!res.ok) return { ok: false, code: res.code, message: res.message.slice(0, 400) };
  const parsed = safeJsonParse(res.text ?? "") as Record<string, unknown> | null;
  if (!parsed) return { ok: false, code: "PARSE", message: "merge parse" };

  const assistantMessage = String(parsed.assistantMessage ?? "").trim();
  if (!assistantMessage) return { ok: false, code: "SCHEMA", message: "assistantMessage 없음" };

  const patches: SlotPatchInput[] = [];
  const plannerAdj = Array.isArray(parsed.plannerSlotAdjustments) ? parsed.plannerSlotAdjustments : [];
  for (const row of plannerAdj) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const slotKey = String(r.slotKey ?? "").trim();
    if (!allKeys.has(slotKey)) continue;
    const def = input.definitions.find((d) => d.slotKey === slotKey);
    if (!def || def.ownerAgent !== "planner") continue;
    patches.push({
      slotKey,
      status: String(r.status ?? "partial"),
      value: r.value === undefined ? undefined : r.value === null ? null : String(r.value).slice(0, 4000),
      confidence: r.confidence === undefined ? undefined : Number(r.confidence),
      ownerAgent: "planner",
      derivedFrom: null,
    });
  }

  const promotions = Array.isArray(parsed.derivedPromotions) ? parsed.derivedPromotions : [];
  if (input.plannerStable) {
    for (const x of promotions) {
      const slotKey = String(x ?? "").trim();
      if (!allKeys.has(slotKey)) continue;
      const def = input.definitions.find((d) => d.slotKey === slotKey);
      if (!def || def.ownerAgent === "planner") continue;
      patches.push({
        slotKey,
        status: "confirmed",
        derivedFrom: null,
        staleReason: null,
      });
    }
  }

  const promptText = `[planner-merge]\n[system]\n${system}\n\n[user]\n${user}`;

  return { ok: true, assistantMessage, patches, promptText, model };
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

  const route = await runPlannerRouteTurnOpenAI(input);
  if (!route.ok) return route;

  promptChunks.push(route.promptText);

  let state = mergeOrchestrationSlotPatches({
    base: input.baseState,
    patches: route.patches,
    nowIso: calledAt,
    definitions: input.definitions,
    propagateStaleFromPlanner: true,
  });

  const slotDepsChanged = route.patches.some((p) => {
    const prev = input.baseState.slots[p.slotKey];
    return prev && prev.ownerAgent === "planner" && String(prev.value ?? "") !== String(p.value ?? "");
  });

  const delegated = route.delegatedAgents;
  const needFlow = delegated.some((d) => FLOW_OWNERS.has(d) && input.activeRoles.has(d));
  const needDesign = delegated.some((d) => DESIGN_OWNERS.has(d) && input.activeRoles.has(d));

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
      participatingAgentsPromptBlock: input.participatingAgentsPromptBlock,
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
      participatingAgentsPromptBlock: input.participatingAgentsPromptBlock,
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
    definitions: input.definitions,
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
    definitions: input.definitions,
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
    const d = defByOwner("service-designer").find((x) => x.slotKey.includes("actors"));
    if (d) bump(d.slotKey, d.ownerAgent, "관리자 액터 언급", 0.55, "service-designer", "candidate");
  }
  if (/일반\s*사용자|고객|이용자|user/.test(lower)) {
    const d = defByOwner("service-designer").find((x) => x.slotKey.includes("actors"));
    if (d && !matched.includes(d.slotKey)) bump(d.slotKey, d.ownerAgent, "일반 사용자 액터 언급", 0.55, "service-designer", "candidate");
  }
  if (/예약|booking|reservation/.test(lower)) {
    const flow = defByOwner("service-designer").find((x) => x.slotKey.includes("userJourney"));
    if (flow) bump(flow.slotKey, flow.ownerAgent, "예약 관련 흐름 언급", 0.5, "service-designer", "candidate");
    const feat = defByOwner("spec-reviewer").find((x) => x.slotKey.includes("featureList"));
    if (feat) bump(feat.slotKey, feat.ownerAgent, "예약 기능 언급", 0.5, "spec-reviewer", "candidate");
  }
  if (/화면|UI|페이지/.test(um)) {
    const d = defByOwner("spec-reviewer").find((x) => x.slotKey.includes("screens"));
    if (d) bump(d.slotKey, d.ownerAgent, "화면/UI 언급", 0.45, "spec-reviewer", "candidate");
  }
  if (/우선|priority|mvp|필수\s*기능/.test(lower)) {
    const d = defByOwner("task-reviewer").find((x) => x.slotKey.includes("priority"));
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

  const delegatedList = filterDelegatesForActiveRoles([...delegatedIntent], input.activeRoles);

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
