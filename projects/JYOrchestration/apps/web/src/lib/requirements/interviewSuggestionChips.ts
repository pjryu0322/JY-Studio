import { normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

/**
 * LLM이 반환한 suggestions만 정규화(트림·중복 제거·개수 상한).
 * 도메인/슬롯/유형별 문구를 추가하지 않는다.
 */
export function normalizeLlmInterviewSuggestions(
  raw: readonly string[] | null | undefined,
  max = 6
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw ?? []) {
    const s = String(x ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** 오케스트레이션 스냅샷(짧은 텍스트) — LLM 프롬프트 컨텍스트용(선택지 생성 아님) */
export function buildOrchestrationInterviewDigest(params: {
  readonly state: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[] | null | undefined;
}): string {
  const { state, definitions } = params;
  if (!state?.slots || !definitions?.length) return "";
  const lines: string[] = [];
  for (const d of definitions) {
    const row = state.slots[d.slotKey];
    if (!row) continue;
    const st = normalizeSlotStatus(String(row.status));
    const v = String(row.value ?? "").trim().replace(/\s+/g, " ").slice(0, 72);
    if (st !== "empty" || v) {
      lines.push(`- ${d.label}: ${st}${v ? ` — ${v}` : ""}`);
    }
    if (lines.length >= 18) break;
  }
  return lines.join("\n");
}
