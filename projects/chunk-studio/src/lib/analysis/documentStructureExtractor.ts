import type { ChunkDTO } from "@/types/job";

export interface ExtractedSectionNode {
  sectionId: string;
  title: string;
  level: number;
  pageStart: number | null;
  pageEnd: number | null;
  path: string;
}

export function extractDocumentStructure(chunks: ChunkDTO[]): ExtractedSectionNode[] {
  const map = new Map<string, ExtractedSectionNode>();
  chunks.forEach((chunk) => {
    const path = chunk.meta.sectionPath.join(" > ").trim() || "Unsectioned";
    const [pageStart, pageEnd] = pageRangeFromChunk(chunk);
    const title = chunk.meta.sectionTitle || lastPathLabel(path) || "Unsectioned";
    const level = Math.max(1, chunk.meta.sectionLevel ?? path.split(" > ").length);
    const current = map.get(path);
    if (!current) {
      map.set(path, {
        sectionId: toSectionId(path),
        title,
        level,
        pageStart,
        pageEnd,
        path,
      });
      return;
    }
    current.pageStart = minNullable(current.pageStart, pageStart);
    current.pageEnd = maxNullable(current.pageEnd, pageEnd);
  });

  return Array.from(map.values()).sort((a, b) => comparePath(a.path, b.path));
}

export function detectSectionNumberPattern(title: string): string | null {
  const matched = title.match(/^(\d+(\.\d+)*)/);
  return matched ? matched[1] : null;
}

function pageRangeFromChunk(chunk: ChunkDTO): [number | null, number | null] {
  const meta = chunk.meta as unknown as { pageRange?: [number, number] };
  if (!Array.isArray(meta.pageRange) || meta.pageRange.length !== 2) return [null, null];
  return [meta.pageRange[0], meta.pageRange[1]];
}

function toSectionId(path: string): string {
  return path
    .toLowerCase()
    .replace(/[^\w가-힣]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function lastPathLabel(path: string): string {
  const parts = path.split(" > ").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function comparePath(a: string, b: string): number {
  if (a === b) return 0;
  return a.localeCompare(b, "ko");
}

function minNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}
