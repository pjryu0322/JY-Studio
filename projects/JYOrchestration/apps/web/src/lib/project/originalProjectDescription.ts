export function isProbablyOriginalProjectDescription(desc: string): boolean {
  const t = String(desc ?? "").trim();
  if (!t) return false;
  // In the wild, conversation-accumulated blobs tend to be long/multiline and contain markers.
  if (t.length > 280) return false;
  if (t.includes("\n")) return false;
  if (/@@|질문:|대화|dialogueExcerpt|role:|speaker/i.test(t)) return false;
  return true;
}

