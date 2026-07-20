/**
 * Pure resolution of build-time context (generation id, embedding profile, tokenizer)
 * for the ND → KU → Chunk pipeline. Does not touch token-counting algorithms.
 */
import { randomUUID } from "node:crypto";
import {
  buildLocalE5EmbeddingProfile,
  createWorkerPassageTokenCounter,
  type PassageTokenCounter,
} from "@/lib/embedding/e5-tokenize-client";

export type DoclingKnowledgeBuildContext = {
  indexGenerationId: string;
  embeddingProfile: ReturnType<typeof buildLocalE5EmbeddingProfile>;
  countTokens: PassageTokenCounter;
};

/** Resolve generation id + embedding profile + tokenizer from optional overrides. */
export function resolveDoclingKnowledgeBuildContext(input: {
  indexGenerationId?: string;
  /** Injectable tokenizer (tests). Defaults to live Local E5 Worker. */
  countTokens?: PassageTokenCounter;
  embeddingProfile?: ReturnType<typeof buildLocalE5EmbeddingProfile>;
}): DoclingKnowledgeBuildContext {
  const indexGenerationId = input.indexGenerationId ?? randomUUID().replace(/-/g, "").slice(0, 24);
  const embeddingProfile = input.embeddingProfile ?? buildLocalE5EmbeddingProfile();
  const countTokens = input.countTokens ?? createWorkerPassageTokenCounter({
    model: embeddingProfile.model,
    modelRevision: embeddingProfile.revision || null,
  });
  return { indexGenerationId, embeddingProfile, countTokens };
}
