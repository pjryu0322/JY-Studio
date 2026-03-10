import type { ChunkDTO } from "@/types/job";

export interface RagRecord {
  chunk_id: string;
  content: string;
  page_start: number | null;
  page_end: number | null;
  section: string;
  subsection: string | null;
  heading: string | null;
  document_title: string | null;
  metadata: Record<string, unknown>;
}

export type RagFormat = "json" | "jsonl" | "csv";
export interface RagRefinementPayload {
  editedLabels?: Record<string, string>;
  reviewNotes?: Record<string, string>;
  excludedChunkIds?: string[];
  mergePairs?: Record<string, string>;
  modifiedChunkIds?: string[];
}

export function buildRagRecords(chunks: ChunkDTO[], documentTitle: string | null): RagRecord[] {
  return chunks.map((chunk, index) => {
    const pageRange = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
    const sectionPath = chunk.meta.sectionPath ?? [];
    return {
      chunk_id: chunk.meta.chunkId || `chunk-${index + 1}`,
      content: chunk.text,
      page_start:
        Array.isArray(pageRange) && pageRange.length === 2 ? pageRange[0] : null,
      page_end:
        Array.isArray(pageRange) && pageRange.length === 2 ? pageRange[1] : null,
      section: sectionPath[0] ?? "Unsectioned",
      subsection: sectionPath.length > 1 ? sectionPath.slice(1).join(" > ") : null,
      heading: chunk.meta.sectionTitle ?? null,
      document_title: documentTitle,
      metadata: {
        type: chunk.meta.type,
        tags: chunk.meta.tags,
        quality: chunk.meta.quality,
        pipelineVersion: chunk.meta.pipelineVersion,
        sourceBlockIds: chunk.meta.sourceBlockIds,
      },
    };
  });
}

export function formatRagRecords(records: RagRecord[], format: RagFormat): string {
  if (format === "json") return JSON.stringify(records, null, 2);
  if (format === "jsonl") return records.map((record) => JSON.stringify(record)).join("\n");
  return toCsv(records);
}

export function applyRagRefinements(
  records: RagRecord[],
  refinements?: RagRefinementPayload
): RagRecord[] {
  if (!refinements) return records;
  const excluded = new Set(refinements.excludedChunkIds ?? []);
  const modified = new Set(refinements.modifiedChunkIds ?? []);
  const edited = refinements.editedLabels ?? {};
  const notes = refinements.reviewNotes ?? {};
  const mergePairs = refinements.mergePairs ?? {};

  return records
    .filter((record) => !excluded.has(record.chunk_id))
    .map((record) => ({
      ...record,
      heading: edited[record.chunk_id] ?? record.heading,
      metadata: {
        ...record.metadata,
        review_note: notes[record.chunk_id] ?? null,
        merge_target_chunk_id: mergePairs[record.chunk_id] ?? null,
        is_modified: modified.has(record.chunk_id),
      },
    }));
}

function toCsv(records: RagRecord[]): string {
  const headers = [
    "chunk_id",
    "content",
    "page_start",
    "page_end",
    "section",
    "subsection",
    "heading",
    "document_title",
    "metadata",
  ];
  const rows = records.map((record) =>
    [
      record.chunk_id,
      record.content,
      record.page_start ?? "",
      record.page_end ?? "",
      record.section,
      record.subsection ?? "",
      record.heading ?? "",
      record.document_title ?? "",
      JSON.stringify(record.metadata),
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
