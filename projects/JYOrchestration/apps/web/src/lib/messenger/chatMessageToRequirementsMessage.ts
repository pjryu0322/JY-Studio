import type { ChatMessage } from "@prisma/client";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

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
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const r of rows) {
    if (r.senderType === "SYSTEM") continue;
    const role: "user" | "assistant" = r.senderType === "USER" ? "user" : "assistant";
    const content = String(r.content ?? "").trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      out.push({ role, content });
    }
  }
  return out;
}
