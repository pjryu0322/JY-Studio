import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsSingleChatOrchestrationStateV1, SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import { plannerSlotKeys, type SlotPatchInput } from "@/lib/requirements/singleChatOrchestrationSlots";
import { filterDelegatesForActiveRoles, parseUpdatedSlotsRows, safeJsonParse } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";

export type PlannerRouteTurnOk = Readonly<{
  ok: true;
  routingDecision: string;
  delegatedAgents: string[];
  matchedSlots: string[];
  patches: SlotPatchInput[];
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
}): Promise<PlannerRouteTurnResult> {
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

