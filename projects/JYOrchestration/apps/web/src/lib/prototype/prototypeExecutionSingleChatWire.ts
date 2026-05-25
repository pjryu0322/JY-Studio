import {
  isRequirementsMessage,
  newRequirementsMessage,
  type RequirementsMessage,
} from "@/lib/requirements/requirementsMessage";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  type PrototypeExecutionInterviewSlot,
  type PrototypeExecutionSingleChatV1,
} from "@/lib/prototype/prototypeExecutionSingleChatTypes";

function normalizeMessages(v: unknown): RequirementsMessage[] {
  if (!Array.isArray(v)) return [];
  const out: RequirementsMessage[] = [];
  for (const it of v) {
    if (isRequirementsMessage(it)) out.push(it);
  }
  return out.slice(-400);
}

function normalizeSlots(v: unknown): PrototypeExecutionInterviewSlot[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: PrototypeExecutionInterviewSlot[] = [];
  for (const it of v) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key.trim() : "";
    const title = typeof r.title === "string" ? r.title.trim() : "";
    const question = typeof r.question === "string" ? r.question.trim() : "";
    const required = Boolean(r.required);
    if (!key || !title) continue;
    out.push({ key, title, question, required });
  }
  return out.length ? out : undefined;
}

function normalizeAnswers(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = String(k ?? "").trim();
    if (!key) continue;
    out[key] = String(val ?? "").trim().slice(0, 4000);
  }
  return Object.keys(out).length ? out : undefined;
}

export function parsePrototypeExecutionSingleChatV1(raw: unknown): PrototypeExecutionSingleChatV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const currentSlotKey =
    o.currentSlotKey === null || o.currentSlotKey === undefined
      ? null
      : typeof o.currentSlotKey === "string"
        ? o.currentSlotKey.trim() || null
        : null;
  return {
    messages: normalizeMessages(o.messages),
    slots: normalizeSlots(o.slots),
    answers: normalizeAnswers(o.answers),
    currentSlotKey,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
  };
}

export function migrateLegacyPrototypeWorkspaceChatToMessages(
  legacy: RequirementsStateJson["prototypeWorkspaceChatV1"] | null | undefined,
  existing: readonly RequirementsMessage[],
): RequirementsMessage[] {
  if (existing.length) return [...existing];
  if (!legacy) return [];
  const aiTitle = displayedWorkspaceAiTitle("prototype_build");
  const out: RequirementsMessage[] = [];
  const lines = [
    ...(legacy.userLog ?? []).map((u) => ({ ...u, role: "user" as const })),
    ...(legacy.aiLog ?? []).map((a) => ({ ...a, role: "ai" as const })),
  ].sort((a, b) => a.at - b.at);
  for (const line of lines) {
    out.push(
      newRequirementsMessage({
        id: `proto-legacy-${line.id}`,
        role: line.role,
        speakerType: line.role === "user" ? "USER" : "AI",
        speakerId: line.role === "user" ? "me" : "prototype_build",
        speakerName: line.role === "user" ? "나" : aiTitle,
        messageType: "STATEMENT",
        content: line.text,
        createdAt: new Date(line.at).toISOString(),
        meta: { serviceDesignStage: "feature-planning", internalType: "PROTOTYPE_LEGACY_CHAT" },
      }),
    );
  }
  return out;
}

export function resolvePrototypeExecutionSingleChatFromState(
  stateJson: unknown,
): PrototypeExecutionSingleChatV1 {
  if (!stateJson || typeof stateJson !== "object") {
    return { messages: [], slots: [], answers: {}, currentSlotKey: null };
  }
  const o = stateJson as Record<string, unknown>;
  const parsed = parsePrototypeExecutionSingleChatV1(o.prototypeExecutionSingleChatV1);
  if (parsed) {
    return {
      messages: parsed.messages ?? [],
      slots: parsed.slots ?? [],
      answers: parsed.answers ?? {},
      currentSlotKey: parsed.currentSlotKey ?? null,
      promptTimeline: parsed.promptTimeline,
      updatedAt: parsed.updatedAt,
    };
  }
  const legacy = o.prototypeWorkspaceChatV1 as RequirementsStateJson["prototypeWorkspaceChatV1"] | undefined;
  return {
    messages: migrateLegacyPrototypeWorkspaceChatToMessages(legacy, []),
    slots: [],
    answers: {},
    currentSlotKey: null,
  };
}
