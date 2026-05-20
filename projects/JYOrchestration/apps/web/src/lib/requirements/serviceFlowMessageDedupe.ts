/**
 * assistantMessage / nextQuestion 중복 제거.
 */

function norm(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[?.!…]/g, "");
}

/** 질문 문장 정규화 — "다음:" 접두·끝 물음표 제거 */
export function normalizeQuestionSentence(raw: string): string {
  let s = String(raw ?? "").trim();
  s = s.replace(/^다음\s*[:：]\s*/i, "").trim();
  s = s.replace(/[?？]+$/g, "").trim();
  return s;
}

/** 동일·포함 관계 문장 제거 */
export function dedupeSentences(lines: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const line = String(raw ?? "").trim();
    if (!line) continue;
    const key = norm(normalizeQuestionSentence(line));
    if (!key || seen.has(key)) continue;
    let dominated = false;
    for (const prev of seen) {
      if (prev.includes(key) || key.includes(prev)) {
        dominated = true;
        break;
      }
    }
    if (dominated) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function sentencesOverlap(a: string, b: string): boolean {
  const na = norm(normalizeQuestionSentence(a));
  const nb = norm(normalizeQuestionSentence(b));
  if (!na || !nb) return false;
  if (na === nb) return true;
  const short = na.length <= nb.length ? na : nb;
  const long = na.length <= nb.length ? nb : na;
  return long.includes(short) && short.length >= 8;
}
