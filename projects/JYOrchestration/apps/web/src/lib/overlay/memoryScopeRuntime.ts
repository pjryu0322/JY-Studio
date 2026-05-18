import type { MemoryScope } from "@/lib/overlay/memoryScopeContract";
import type { PromptAssemblyMemoryRef } from "@/lib/overlay/contextAssemblyContract";

/**
 * 저장소·출처 라벨 문자열을 Overlay MemoryScope로 매핑한다. DB/스키마를 바꾸지 않는다.
 */
export function resolveMemoryScopeFromSource(source: string | null | undefined): MemoryScope {
  const s = String(source ?? "").trim().toLowerCase();
  if (!s) return "session";
  if (s.includes("requirementsstatejson")) return "project";
  if (s.includes("singlechatorchestration")) return "project";
  if (s.includes("chatmessage")) return "session";
  if (s.includes("messengerprompttimelinelog")) return "session";
  if (s.includes("prompttimeline")) return "session";
  if (s.includes("localstorage")) return "working";
  if (s.includes("sessionstorage")) return "working";
  if (s.includes("platformaimembers")) return "platform";
  if (s.includes("projectmember")) return "project";
  return "session";
}

export function buildPromptAssemblyMemoryRef(source: string, ref: string): PromptAssemblyMemoryRef {
  return {
    scope: resolveMemoryScopeFromSource(source),
    ref: String(ref ?? "").trim().slice(0, 500) || "unknown",
  };
}

/** 진단 API용: `resolveMemoryScopeFromSource`와 동일 규칙의 대표 라벨(읽기 전용) */
export const OVERLAY_MEMORY_SCOPE_SOURCE_RULES: readonly { readonly sourceLabel: string; readonly scope: MemoryScope }[] = [
  { sourceLabel: "requirementsStateJson", scope: "project" },
  { sourceLabel: "singleChatOrchestrationV1", scope: "project" },
  { sourceLabel: "ChatMessage", scope: "session" },
  { sourceLabel: "MessengerPromptTimelineLog", scope: "session" },
  { sourceLabel: "promptTimeline", scope: "session" },
  { sourceLabel: "localStorage", scope: "working" },
  { sourceLabel: "sessionStorage", scope: "working" },
  { sourceLabel: "platformAiMembers", scope: "platform" },
  { sourceLabel: "ProjectMember", scope: "project" },
];
