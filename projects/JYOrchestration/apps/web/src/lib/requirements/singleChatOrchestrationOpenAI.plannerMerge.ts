import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsSingleChatOrchestrationStateV1, SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { SlotPatchInput } from "@/lib/requirements/singleChatOrchestrationSlots";
import { safeJsonParse } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";

export type PlannerMergeTurnOk = Readonly<{ ok: true; assistantMessage: string; patches: SlotPatchInput[]; promptText: string; model: string }>;
export type PlannerMergeTurnErr = Readonly<{ ok: false; code: string; message: string }>;
export type PlannerMergeTurnResult = PlannerMergeTurnOk | PlannerMergeTurnErr;

export async function runPlannerMergeTurnOpenAI(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly userMessage: string;
  readonly dialogueExcerpt: string;
  readonly state: RequirementsSingleChatOrchestrationStateV1;
  readonly specialistDigest: string;
  readonly plannerStable: boolean;
  readonly participatingAgentsPromptBlock: string;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): Promise<PlannerMergeTurnResult> {
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
당신은 SingleChat의 **merge coordinator**입니다.
목표는 "대화 품질"이 아니라 **오케스트레이션 상태(state) 업데이트**입니다.
사용자에게 보이는 문장/톤/질문을 만들지 마라. assistantMessage는 쓰지 않는다.

${stableLine}

출력 JSON 필드:
- plannerSlotAdjustments: planner 소유 슬롯만 { slotKey, status, value?, confidence? }
- derivedPromotions: (planner 안정 시만) 비-planner 슬롯을 confirmed로 승격할 slotKey 배열

출력 JSON:
{
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

  // merge coordinator는 user-facing assistantMessage를 만들지 않는다.
  const assistantMessage = "";

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

