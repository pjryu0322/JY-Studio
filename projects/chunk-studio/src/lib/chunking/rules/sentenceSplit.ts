const SENTENCE_BOUNDARY = /(?<=[.!?。！？]|다\.|요\.)\s+/g;

export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const base = normalized
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter(Boolean);
  return base.length > 0 ? base : [normalized];
}

export function takeLastSentences(text: string, sentenceCount: number): string {
  const sentences = splitSentences(text);
  if (sentences.length <= sentenceCount) return text.trim();
  return sentences.slice(-sentenceCount).join(" ").trim();
}

