import { createHash } from "crypto";

export const KP_CHUNK_DEFAULT_MAX = 1200;
export const KP_CHUNK_DEFAULT_OVERLAP = 150;

export function contentHashForChunk(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** 겹침을 두고 텍스트를 청크 문자열 배열로 분할한다. */
export function splitTextIntoOverlappingChunks(
  text: string,
  maxChunkChars: number = KP_CHUNK_DEFAULT_MAX,
  overlapChars: number = KP_CHUNK_DEFAULT_OVERLAP
): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t.length) return [];

  const max = Math.max(200, Math.floor(maxChunkChars));
  const overlap = Math.min(Math.max(0, Math.floor(overlapChars)), Math.floor(max * 0.45));
  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    const end = Math.min(t.length, start + max);
    chunks.push(t.slice(start, end));
    if (end >= t.length) break;
    const nextStart = end - overlap;
    start = nextStart > start ? nextStart : end;
  }
  return chunks;
}
