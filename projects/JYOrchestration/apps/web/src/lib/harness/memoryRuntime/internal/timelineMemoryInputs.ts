/**
 * Harness Phase H4 / H4.5 — overlay turn 입력 → Memory Runtime planner 입력 변환.
 *
 * **read-only / heuristic.** 실제 prompt payload·LLM 호출에 영향 없음.
 * `overlayPromptTraceAugment`에서 사용되며, 분리해 단일 출처를 유지한다.
 *
 * H4.5 stabilization: `normalizeTimelineMemoryMessages`가 도입되어 noise/중복/디버그
 * 메시지를 안전하게 제거하고, 다른 추출 helper들이 normalized 결과만 사용한다.
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

/**
 * timeline 메시지 정규화 시 최소 텍스트 길이(NFC trim 기준).
 * H4.5에서 8 → 10으로 보수적 조정(noise 제거 강화).
 */
export const MEMORY_RUNTIME_TIMELINE_MIN_TEXT = 10;
/** 한 turn에서 planner에 넘길 timeline entry 최대 개수. */
export const MEMORY_RUNTIME_TIMELINE_INPUT_MAX = 12;
/** normalize 시 1개 메시지의 길이 상한(메모리 진단 비대화 방지). */
const MEMORY_RUNTIME_TIMELINE_MAX_TEXT_LENGTH = 2_000;
/** normalize 결과의 전체 메시지 상한. */
const MEMORY_RUNTIME_TIMELINE_NORMALIZED_MAX = 32;

/**
 * "내용은 없고 마커/상태만 있는" 문자열을 제거하기 위한 정규식 / 토큰 집합.
 *
 * - JSON fragment (`{}`, `[]`, `[object Object]`)
 * - debug-only status (`SUCCESS`, `OK`, `undefined`, `null`, `n/a`)
 * - HTTP status-only (`HTTP 200`, `HTTP 404`)
 * - 단일 토큰 영문 대문자/소문자(예: `STARTED`) — Korean은 영향 없음.
 *
 * 한국어 문장과 multi-token 영문 문장은 그대로 통과한다.
 */
const NOISE_EXACT_TOKENS = new Set<string>([
  "{}",
  "[]",
  "[object object]",
  "undefined",
  "null",
  "nan",
  "n/a",
  "true",
  "false",
  "success",
  "ok",
  "done",
  "started",
  "pending",
  "ready",
]);

const NOISE_HTTP_PATTERN = /^http\/?\s*\d{3}\s*[a-z]*$/i;
const NOISE_BRACKET_ONLY_PATTERN = /^[\s{}\[\]()<>,;:.|`'"!?-]+$/;

/**
 * 메시지가 noise(내용 없는 마커·상태 문구)인지 판정.
 *
 * **note**: 한국어/영문 의미 있는 문장은 false 반환.
 */
function isNoiseMessage(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  if (NOISE_EXACT_TOKENS.has(lower)) return true;
  if (NOISE_HTTP_PATTERN.test(text)) return true;
  if (NOISE_BRACKET_ONLY_PATTERN.test(text)) return true;
  // JSON-only payload(중괄호 시작/종료, escape 비율 높음)는 디버그 fragment로 간주.
  if (/^\s*[{\[].*[}\]]\s*$/.test(text) && /["\\:]/.test(text) && text.length <= 64) {
    return true;
  }
  return false;
}

/**
 * timeline 메시지 → 정규화된 메모리 입력 텍스트.
 *
 * 처리 기준(H4.5):
 * - 빈 문자열·whitespace-only 제거.
 * - `MEMORY_RUNTIME_TIMELINE_MIN_TEXT` 미만 문장은 noise로 간주하고 제거.
 * - 동일 문장(공백 정규화 후 비교) 중복 제거(첫 등장 우선).
 * - JSON fragment / debug marker / HTTP status-only 등 의미 없는 마커 제거.
 * - 한국어/영문 의미 있는 문장은 유지.
 * - 메시지당 길이 상한(`MEMORY_RUNTIME_TIMELINE_MAX_TEXT_LENGTH`).
 * - 전체 결과 상한(`MEMORY_RUNTIME_TIMELINE_NORMALIZED_MAX`).
 *
 * **순수 함수.** payload·라우팅·LLM 호출에 영향 없음.
 */
export function normalizeTimelineMemoryMessages(
  rawMessages: readonly (string | null | undefined)[] | undefined
): readonly string[] {
  if (!rawMessages?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawMessages) {
    if (typeof raw !== "string") continue;
    const collapsed = raw.replace(/\s+/g, " ").trim();
    if (collapsed.length < MEMORY_RUNTIME_TIMELINE_MIN_TEXT) continue;
    if (isNoiseMessage(collapsed)) continue;
    const clipped = collapsed.slice(0, MEMORY_RUNTIME_TIMELINE_MAX_TEXT_LENGTH);
    const dedupeKey = clipped.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(clipped);
    if (out.length >= MEMORY_RUNTIME_TIMELINE_NORMALIZED_MAX) break;
  }
  return out;
}

/**
 * timeline 메시지 텍스트들에서 가벼운 방향 키워드 추출.
 *
 * 입력은 먼저 `normalizeTimelineMemoryMessages`로 정제된 후 사용된다(noise 차단).
 * - "microservice"/"monolith" 같은 단어가 등장하면 directional keyword로 인식.
 * - **휴리스틱**: 메모리 conflict 진단 입력으로만 사용된다(실제 라우팅/payload에 영향 없음).
 */
export function extractDirectionalKeywordsFromTimelineMessages(
  rawMessages: readonly (string | null | undefined)[] | undefined
): readonly string[] {
  const normalized = normalizeTimelineMemoryMessages(rawMessages);
  if (!normalized.length) return [];
  const tokens = new Set<string>();
  for (const message of normalized) {
    const lower = message.toLowerCase();
    for (const seed of MEMORY_DIRECTIONAL_KEYWORD_SEEDS) {
      if (lower.includes(seed)) tokens.add(seed);
    }
  }
  return Array.from(tokens);
}

/**
 * timeline 메시지 → Memory Runtime planner의 entries 변환.
 *
 * 정규화된 결과만 entry로 만든다(상한 `MEMORY_RUNTIME_TIMELINE_INPUT_MAX`).
 */
export function buildMemoryRuntimeEntriesFromTimelineMessages(
  rawMessages: readonly (string | null | undefined)[] | undefined
): readonly MemoryRuntimeTimelineEntryInput[] {
  const normalized = normalizeTimelineMemoryMessages(rawMessages);
  if (!normalized.length) return [];
  const out: MemoryRuntimeTimelineEntryInput[] = [];
  for (let i = 0; i < normalized.length; i += 1) {
    out.push({
      text: normalized[i],
      source: `MessengerPromptTimelineLog#${i + 1}`,
      at: null,
    });
    if (out.length >= MEMORY_RUNTIME_TIMELINE_INPUT_MAX) break;
  }
  return out;
}

/** 최근 사용자 메시지 텍스트 1건(working context summary용). */
export function pickRecentUserTextFromTimelineMessages(
  rawMessages: readonly (string | null | undefined)[] | undefined
): string | null {
  const normalized = normalizeTimelineMemoryMessages(rawMessages);
  if (!normalized.length) return null;
  // 가장 최근 메시지(원본 순서 보존 기준 마지막)를 사용자 입력 후보로 본다.
  return normalized[normalized.length - 1] ?? null;
}
