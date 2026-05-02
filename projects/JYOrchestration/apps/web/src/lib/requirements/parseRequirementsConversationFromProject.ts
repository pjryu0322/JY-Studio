import { newConversation, type RequirementsConversation } from "@/lib/requirements/conversationStore";
import { coerceRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";

function unwrapDbJsonField(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const s = raw.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

export function parseRequirementsConversationFromProjectJson(raw: unknown, projectId: string): RequirementsConversation {
  const root = unwrapDbJsonField(raw);
  if (!root || typeof root !== "object") return newConversation(projectId);
  const o = root as Record<string, unknown>;
  const stage = o.stage === "REQUIREMENTS" ? "REQUIREMENTS" : "REQUIREMENTS";
  const msgsRaw = Array.isArray(o.messages) ? o.messages : [];
  const msgs: RequirementsMessage[] = [];
  for (const m of msgsRaw) {
    const row = coerceRequirementsMessage(m);
    if (row) msgs.push(row);
  }
  return {
    projectId: typeof o.projectId === "string" && o.projectId.trim() ? String(o.projectId) : projectId,
    stage,
    messages: msgs,
  };
}
