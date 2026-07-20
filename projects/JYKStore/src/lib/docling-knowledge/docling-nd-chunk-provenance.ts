/**
 * Retrieval-chunk provenance metadata + pre-save validation.
 */
import type { TokenAwareSplitPiece } from "@/lib/docling-knowledge/token-aware-chunk-split";
import { MAX_RESPLIT_DEPTH } from "@/lib/docling-knowledge/docling-nd-token-split-policy";

export function pieceProvenanceMeta(
  piece: TokenAwareSplitPiece,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    splitSourceId: piece.splitSourceId,
    splitIndex: piece.splitIndex,
    splitCount: piece.splitCount,
    overlapTokens: piece.actualOverlapTokens,
    configuredOverlapTokens: piece.configuredOverlapTokens,
    actualOverlapTokens: piece.actualOverlapTokens,
    hasOverlap: piece.hasOverlap,
    primaryContent: piece.primaryContent,
    primarySourceTextStart: piece.primarySourceTextStart,
    primarySourceTextEnd: piece.primarySourceTextEnd,
    overlapSourceTextStart: piece.overlapSourceTextStart,
    overlapSourceTextEnd: piece.overlapSourceTextEnd,
    sourceTextStart: piece.sourceTextStart,
    sourceTextEnd: piece.sourceTextEnd,
    tokenCount: piece.tokenCount,
    ...(piece.tableMeta ?? {}),
    ...(extra ?? {}),
  };
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function validateChunkProvenanceBeforeSave(
  creates: Array<{
    title?: unknown;
    content?: unknown;
    metadata?: unknown;
  }>,
  targetPassageTokens: number,
): { ok: true } | { ok: false; code: string; message: string } {
  for (const created of creates) {
    const md =
      created.metadata && typeof created.metadata === "object"
        ? (created.metadata as Record<string, unknown>)
        : {};
    const tokenCount = asNumber(md.tokenCount);
    if (tokenCount != null && tokenCount > targetPassageTokens) {
      return {
        ok: false,
        code: "PASSAGE_TARGET_TOKEN_EXCEEDED",
        message: `tokenCount ${tokenCount} exceeds target ${targetPassageTokens}`,
      };
    }
    const start = asNumber(md.primarySourceTextStart);
    const end = asNumber(md.primarySourceTextEnd);
    if (start != null && end != null && start > end) {
      return {
        ok: false,
        code: "CHUNK_PROVENANCE_INVALID",
        message: "primarySourceTextStart > primarySourceTextEnd",
      };
    }
    const oStart = asNumber(md.overlapSourceTextStart);
    const oEnd = asNumber(md.overlapSourceTextEnd);
    if ((oStart == null) !== (oEnd == null)) {
      return {
        ok: false,
        code: "CHUNK_PROVENANCE_INVALID",
        message: "overlap source range partially set",
      };
    }
    if (oStart != null && oEnd != null && oStart > oEnd) {
      return {
        ok: false,
        code: "CHUNK_PROVENANCE_INVALID",
        message: "overlapSourceTextStart > overlapSourceTextEnd",
      };
    }
    const headers = md.tableHeaders;
    if (Array.isArray(headers) && md.contentKind === "TABLE") {
      const content = String(created.content);
      const rowLine = content.split("\n").find((l) => l.includes("|") && !l.startsWith("컬럼:"));
      if (rowLine) {
        const cols = rowLine.split("|").map((c) => c.trim());
        if (cols.length !== headers.length) {
          return {
            ok: false,
            code: "TABLE_COLUMN_STRUCTURE_INVALID",
            message: `row cols ${cols.length} != headers ${headers.length}`,
          };
        }
      }
    }
    const depth = asNumber(md.resplitDepth) ?? 0;
    if (depth > MAX_RESPLIT_DEPTH) {
      return {
        ok: false,
        code: "CHUNK_TOKEN_RESPLIT_EXHAUSTED",
        message: `resplitDepth ${depth} exceeds ${MAX_RESPLIT_DEPTH}`,
      };
    }
  }
  return { ok: true };
}
