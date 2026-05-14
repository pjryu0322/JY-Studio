/**
 * Harness Phase H4 Preparation — overlay turn 입력 → Memory Runtime planner 입력 변환.
 *
 * **read-only / heuristic.** 실제 prompt payload·LLM 호출에 영향 없음.
 * `overlayPromptTraceAugment`에서 사용되며, 분리해 단일 출처를 유지한다.
 */

import type { MemoryRuntimeTimelineEntryInput } from "@/lib/harness/memoryRuntime/buildMemoryRuntimePlan";

/** 메모리 conflict 진단 입력으로 사용되는 단순 방향 키워드 후보(휴리스틱). */
const MEMORY_DIRECTIONAL_KEYWORD_SEEDS: readonly string[] = [
  "monolith",
  "microservice",
  "sync",
  "async",
  "sql",
  "nosql",
  "cloud",
  "on-premise",
  "client-side",
  "server-side",
];

/** timeline 메시지 → planner의 timeline entry input 변환 시 최소 텍스트 길이. */
const MEMORY_RUNTIME_TIMELINE_MIN_TEXT = 8;
/** 한 turn에서 planner에 넘길 timeline entry 최대 개수. */
const MEMORY_RUNTIME_TIMELINE_INPUT_MAX = 12;

/**
 * timeline 메시지 텍스트들에서 가벼운 방향 키워드 추출.
 *
 * - 현재 turn 메시지에 "microservice"/"monolith" 같은 단어가 등장하면 directional keyword로 인식.
 * - **휴리스틱**: 메모리 conflict 진단 입력으로만 사용된다(실제 라우팅/payload에 영향 없음).
 */
export function extractDirectionalKeywordsFromTimelineMessages(
  rawMessages: readonly (string | null | undefined)[] | undefined
): readonly string[] {
  if (!rawMessages?.length) return [];
  const tokens = new Set<string>();
  for (const m of rawMessages) {
    const text = typeof m === "string" ? m.toLowerCase() : "";
    if (!text) continue;
    for (const seed of MEMORY_DIRECTIONAL_KEYWORD_SEEDS) {
      if (text.includes(seed)) tokens.add(seed);
    }
  }
  return Array.from(tokens);
}

/**
 * timeline 메시지 → Memory Runtime planner의 entries 변환.
 *
 * 각 메시지를 후보 메모리 entry로 본다(text/source/at만 채움).
 * 너무 짧으면 drop, 상한 적용.
 */
export function buildMemoryRuntimeEntriesFromTimelineMessages(
  rawMessages: readonly (string | null | undefined)[] | undefined
): readonly MemoryRuntimeTimelineEntryInput[] {
  if (!rawMessages?.length) return [];
  const out: MemoryRuntimeTimelineEntryInput[] = [];
  let idx = 0;
  for (const m of rawMessages) {
    idx += 1;
    const text = typeof m === "string" ? m.trim() : "";
    if (text.length < MEMORY_RUNTIME_TIMELINE_MIN_TEXT) continue;
    out.push({ text, source: `MessengerPromptTimelineLog#${idx}`, at: null });
    if (out.length >= MEMORY_RUNTIME_TIMELINE_INPUT_MAX) break;
  }
  return out;
}

/** 최근 user text 1건 추출(working context summary용). */
export function pickRecentUserTextFromTimelineMessages(
  rawMessages: readonly (string | null | undefined)[] | undefined
): string | null {
  if (!rawMessages?.length) return null;
  for (let i = rawMessages.length - 1; i >= 0; i--) {
    const m = rawMessages[i];
    if (typeof m === "string" && m.trim().length >= MEMORY_RUNTIME_TIMELINE_MIN_TEXT) {
      return m.trim();
    }
  }
  return null;
}
