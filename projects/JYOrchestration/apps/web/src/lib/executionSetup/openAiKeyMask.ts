/** UI·저장용 마스킹 — 키 본문은 로그에 남기지 않습니다. */
export function maskOpenAiKeyForUi(key: string): string {
  const t = String(key ?? "").trim();
  if (!t) return "";
  if (t.length <= 10) return "sk-…***";
  return `${t.slice(0, 7)}…${t.slice(-4)}`;
}
