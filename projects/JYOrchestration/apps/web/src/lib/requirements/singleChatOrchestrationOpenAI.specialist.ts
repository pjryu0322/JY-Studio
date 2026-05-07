import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsSingleChatOrchestrationStateV1, SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { SlotPatchInput } from "@/lib/requirements/singleChatOrchestrationSlots";
import { parseUpdatedSlotsRows, safeJsonParse } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";

export async function runSpecialistGroupTurnOpenAI(input: {
  readonly groupLabel: "flow-analyst" | "feature-designer";
  readonly projectName: string;
  readonly projectDescription: string;
  readonly userMessage: string;
  readonly dialogueExcerpt: string;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly state: RequirementsSingleChatOrchestrationStateV1;
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

