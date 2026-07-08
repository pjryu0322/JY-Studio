import {
  exportChunkMimeType,
  type ExportChunkKind,
  type ExportChunkResponse,
} from "@/lib/export-chunk-dto";
import { ExportChunkRangeError, sliceUtf8TextByBytes } from "@/lib/export-chunking";
import {
  buildGraphExport,
  buildPackageExport,
  buildRagJsonlExport,
} from "@/lib/knowledge-export-service";

export async function buildExportSourceText(input: {
  knowledgePackId: string;
  exportType: ExportChunkKind;
}): Promise<{ text: string; mimeType: string } | null> {
  const { knowledgePackId, exportType } = input;
  switch (exportType) {
    case "package": {
      const payload = await buildPackageExport(knowledgePackId);
      if (payload === null) return null;
      return {
        text: JSON.stringify(payload, null, 2),
        mimeType: exportChunkMimeType("package"),
      };
    }
    case "rag-jsonl": {
      const payload = await buildRagJsonlExport(knowledgePackId);
      if (payload === null) return null;
      return {
        text: payload,
        mimeType: exportChunkMimeType("rag-jsonl"),
      };
    }
    case "graph": {
      const payload = await buildGraphExport(knowledgePackId);
      if (payload === null) return null;
      return {
        text: JSON.stringify(payload, null, 2),
        mimeType: exportChunkMimeType("graph"),
      };
    }
    default: {
      const _exhaustive: never = exportType;
      return _exhaustive;
    }
  }
}

/**
 * Build a UTF-8-safe export chunk. Returns null when the pack is not public
 * (same visibility as full export builders).
 */
export async function buildExportChunk(input: {
  knowledgePackId: string;
  exportType: ExportChunkKind;
  offset: number;
  limitBytes: number;
  requestId?: string;
}): Promise<ExportChunkResponse | null> {
  const source = await buildExportSourceText({
    knowledgePackId: input.knowledgePackId,
    exportType: input.exportType,
  });
  if (!source) return null;

  const slice = sliceUtf8TextByBytes(source.text, input.offset, input.limitBytes);
  return {
    knowledgePackId: input.knowledgePackId,
    exportType: input.exportType,
    offset: input.offset,
    limitBytes: input.limitBytes,
    nextOffset: slice.nextOffset,
    hasMore: slice.hasMore,
    byteLength: slice.byteLength,
    totalBytes: slice.totalBytes,
    mimeType: source.mimeType,
    content: slice.content,
  };
}

export { ExportChunkRangeError };

/**
 * Pure helper for tests: slice a prebuilt source string into an ExportChunkResponse.
 */
export function sliceExportSourceToChunkResponse(input: {
  knowledgePackId: string;
  exportType: ExportChunkKind;
  sourceText: string;
  offset: number;
  limitBytes: number;
}): ExportChunkResponse {
  const slice = sliceUtf8TextByBytes(input.sourceText, input.offset, input.limitBytes);
  return {
    knowledgePackId: input.knowledgePackId,
    exportType: input.exportType,
    offset: input.offset,
    limitBytes: input.limitBytes,
    nextOffset: slice.nextOffset,
    hasMore: slice.hasMore,
    byteLength: slice.byteLength,
    totalBytes: slice.totalBytes,
    mimeType: exportChunkMimeType(input.exportType),
    content: slice.content,
  };
}
