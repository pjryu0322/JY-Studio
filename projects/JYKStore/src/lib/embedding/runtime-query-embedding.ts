/**
 * P7.6: Runtime query embedding — the ONLY embedding TypeScript generates.
 *
 * Ownership split:
 *  - Python Worker (ZIP pipeline) is the single source of DOCUMENT/CHUNK
 *    embeddings (`embeddings.json`). The Store validates/persists/reflects them
 *    and NEVER re-embeds documents or chunks.
 *  - The one embedding computed on the TS side is the SEARCH QUERY vector, made
 *    at query time so it can be compared (pgvector cosine) against the
 *    Worker-produced chunk vectors.
 *
 * This module deliberately exposes ONLY a query-embedding surface. It must never
 * be used to (re)embed documents or chunks. The descriptor is taken from the
 * SearchIndexGeneration — which mirrors the Worker's E5 model descriptor — so the
 * query vector always matches the stored chunk vectors' provider/model/dimension.
 */
import type {
  EmbeddingDescriptor,
  EmbeddingProviderAdapter,
} from "@/lib/embedding/embedding-provider-adapter";
import { resolveEmbeddingProviderAdapterForDescriptor } from "@/lib/embedding/embedding-provider-registry";

export type ResolveQueryEmbeddingAdapter = (
  descriptor: EmbeddingDescriptor,
) => EmbeddingProviderAdapter;

export type EmbedSearchQueryInput = {
  /** Descriptor from the SearchIndexGeneration (mirrors the Worker E5 model). */
  descriptor: EmbeddingDescriptor;
  /** Raw search query text. */
  text: string;
  /** Test injection only; production callers must omit. */
  resolveAdapter?: ResolveQueryEmbeddingAdapter;
};

/**
 * Embed a single search query. Runtime-query-only: never embeds documents/chunks.
 * Uses the adapter's single-text `embed()` (not the batch passage path).
 */
export async function embedSearchQuery(
  input: EmbedSearchQueryInput,
): Promise<{ vector: number[] }> {
  const resolveAdapter =
    input.resolveAdapter ?? resolveEmbeddingProviderAdapterForDescriptor;
  const adapter = resolveAdapter(input.descriptor);
  const result = await adapter.embed({ text: input.text });
  return { vector: result.vector };
}
