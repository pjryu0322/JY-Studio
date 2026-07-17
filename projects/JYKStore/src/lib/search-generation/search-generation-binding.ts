import { PayloadServiceError } from "@/lib/distribution/payload-errors";

/**
 * Dual-read for chunk generation (§21): prefer the explicit column, fall back to
 * legacy metadata.indexGenerationId.
 */
export function resolveChunkGenerationId(chunk: {
  chunkGenerationId?: string | null;
  metadata?: unknown;
}): string | null {
  if (chunk.chunkGenerationId) return chunk.chunkGenerationId;
  const meta = chunk.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const value = (meta as Record<string, unknown>).indexGenerationId;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/**
 * Dual-read for a validation run's search generation (§23): prefer the explicit FK,
 * fall back to the legacy indexGenerationId string.
 */
export function resolveValidationRunSearchGenerationId(run: {
  searchIndexGenerationId?: string | null;
  indexGenerationId?: string | null;
}): string | null {
  return run.searchIndexGenerationId ?? run.indexGenerationId ?? null;
}

/**
 * §23 invariant: when both the FK and the legacy string are present they must
 * point at the same generation, otherwise creation/submit/approval is blocked.
 */
export function assertValidationRunGenerationConsistent(run: {
  searchIndexGenerationId?: string | null;
  indexGenerationId?: string | null;
}): void {
  const fk = run.searchIndexGenerationId ?? null;
  const legacy = run.indexGenerationId ?? null;
  if (fk != null && legacy != null && fk !== legacy) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_MISMATCH",
      "검증 실행의 검색 세대 식별자가 일치하지 않습니다.",
      409,
    );
  }
}

/**
 * Dual-write payload for a chunk: set the column and mirror into metadata so the
 * legacy metadata reader keeps working during the compatibility window (§21).
 */
export function buildChunkGenerationDualWrite(
  chunkGenerationId: string,
  existingMetadata?: unknown,
): { chunkGenerationId: string; metadata: Record<string, unknown> } {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};
  base.indexGenerationId = chunkGenerationId;
  return { chunkGenerationId, metadata: base };
}

/**
 * Dual-write payload for a validation run: keep legacy indexGenerationId in sync
 * with the FK so old readers still resolve the generation (§23/§34).
 */
export function buildValidationRunGenerationDualWrite(searchIndexGenerationId: string): {
  searchIndexGenerationId: string;
  indexGenerationId: string;
} {
  return { searchIndexGenerationId, indexGenerationId: searchIndexGenerationId };
}
