import type { ChatMessage } from "@prisma/client";
import {
  isMessengerSystemAutoReplyNotice,
  type MessengerAiHistoryTurn,
} from "@/lib/messenger/messengerAiHistoryFilter";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

function messengerHistoryMetaFromRow(row: ChatMessage): MessengerAiHistoryTurn["meta"] {
  const md = row.metadata;
  if (!md || typeof md !== "object" || Array.isArray(md)) return undefined;
  const rec = md as Record<string, unknown>;
  const source = String(rec.source ?? "").trim();
  const kind = String(rec.kind ?? "").trim();
  if (source === "work_note_summarize" || kind === "ai_work_note_summary") {
    return { internalType: "ai_work_note_summary", kind: "ai_work_note_summary" };
  }
  return kind ? { kind } : undefined;
}

/** LLM 이력 필터용 — 메시지별 role/content/meta (병합 전) */
export function buildMessengerHistoryTurnsFromChatRows(rows: readonly ChatMessage[]): MessengerAiHistoryTurn[] {
  const out: MessengerAiHistoryTurn[] = [];
  for (const row of rows) {
    if (row.senderType === "SYSTEM") {
      out.push({
        role: "assistant",
        content: String(row.content ?? ""),
        meta: messengerHistoryMetaFromRow(row),
      });
      continue;
    }
    const role: "user" | "assistant" = row.senderType === "USER" ? "user" : "assistant";
    out.push({
      role,
      content: String(row.content ?? ""),
      meta: messengerHistoryMetaFromRow(row),
    });
  }
  return out;
}

export function mergeMessengerHistoryTurns(
  turns: readonly MessengerAiHistoryTurn[]
): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const turn of turns) {
    const content = String(turn.content ?? "").trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === turn.role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      out.push({ role: turn.role, content });
    }
  }
  return out;
}

function messengerRoomInternalType(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "messenger_room";
  const source = String((metadata as Record<string, unknown>).source ?? "").trim();
  if (source === "work_note_summarize") return "ai_work_note_summary";
  return "messenger_room";
}

export function chatMessagesToRequirementsMessages(rows: readonly ChatMessage[]): RequirementsMessage[] {
  const out: RequirementsMessage[] = [];
  for (const r of rows) {
    if (r.senderType === "SYSTEM") {
      out.push(
        newRequirementsMessage({
          id: r.id,
          role: "system",
          speakerType: "SYSTEM",
          speakerId: r.senderId ?? "system",
          speakerName: r.senderName || "시스템",
          messageType: "NOTICE",
          content: r.content,
          createdAt: r.createdAt.toISOString(),
          meta: {
            internalType: "messenger_room",
          },
        })
      );
      continue;
    }
    const isUser = r.senderType === "USER";
    const internalType = messengerRoomInternalType(r.metadata);
    out.push(
      newRequirementsMessage({
        id: r.id,
        role: isUser ? "user" : "ai",
        speakerType: isUser ? "USER" : "AI",
        speakerId: r.senderId ?? (isUser ? "me" : "ai"),
        speakerName: r.senderName || (isUser ? "나" : "AI 기획자"),
        messageType: isUser ? "STATEMENT" : "ANSWER",
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        meta: {
          internalType,
          source: r.senderType === "AI" ? "llm" : undefined,
        },
      })
    );
  }
  return out;
}

export function buildMessengerTranscriptForLlm(rows: readonly ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  return mergeMessengerHistoryTurns(
    buildMessengerHistoryTurnsFromChatRows(rows).filter(
      (t) => Boolean(String(t.content ?? "").trim()) && !isMessengerSystemAutoReplyNotice(t.content)
    )
  );
}
