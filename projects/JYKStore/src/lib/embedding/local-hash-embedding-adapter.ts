// P5: async wrapper around the existing deterministic local-hash embedding logic.
// This is the same non-semantic development/foundation provider as
// @/lib/local-embedding-provider, exposed through the async EmbeddingProviderAdapter
// interface so it can be swapped for external providers via the registry.

import {
  assertFiniteVector,
  assertNotCancelled,
  type EmbeddingBatchRequest,
  type EmbeddingBatchResult,
  type EmbeddingProviderAdapter,
  type EmbeddingProviderHealth,
  type EmbeddingRequest,
  type EmbeddingResult,
} from "@/lib/embedding/embedding-provider-adapter";
import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import { embedTextLocalHash } from "@/lib/local-embedding-provider";

export const LOCAL_HASH_PRODUCTION_WARNING =
  "WARNING: local-hash is a deterministic non-semantic development embedding provider. " +
  "It must not be used in production search.";

export function createLocalHashEmbeddingAdapter(
  dimension: number = DEFAULT_EMBEDDING_DIMENSION,
  model: string = DEFAULT_EMBEDDING_MODEL,
): EmbeddingProviderAdapter {
  const descriptor = { provider: DEFAULT_EMBEDDING_PROVIDER, model, dimension };

  function embedOne(text: string): number[] {
    const vector = embedTextLocalHash(text, dimension);
    assertFiniteVector(vector, dimension, "local-hash");
    return vector;
  }

  return {
    id: DEFAULT_EMBEDDING_PROVIDER,
    resolveDescriptor: () => ({ ...descriptor }),
    async embed(input: EmbeddingRequest): Promise<EmbeddingResult> {
      assertNotCancelled(input.signal, "local-hash.embed");
      return { ...descriptor, vector: embedOne(input.text) };
    },
    async embedBatch(input: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
      assertNotCancelled(input.signal, "local-hash.embedBatch");
      const vectors = input.texts.map((text) => {
        assertNotCancelled(input.signal, "local-hash.embedBatch");
        return embedOne(text);
      });
      return { ...descriptor, vectors };
    },
    async healthCheck(): Promise<EmbeddingProviderHealth> {
      return {
        ok: true,
        provider: descriptor.provider,
        checkedAt: new Date().toISOString(),
        warning: LOCAL_HASH_PRODUCTION_WARNING,
      };
    },
  };
}
