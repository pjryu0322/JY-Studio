import {
  E5_MAX_SEQUENCE_TOKENS,
  E5_PASSAGE_PREFIX,
  E5_QUERY_PREFIX,
} from "@/lib/embedding/e5-embedding-constants";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

/**
 * Conservative token estimate (no silent truncate). ~4 chars/token works reasonably
 * for mixed Korean/English without pulling in a tokenizer in Node.
 */
export function estimateEmbeddingTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
}

export function buildQueryEmbeddingText(query: string): string {
  const q = query.trim();
  if (q.startsWith("query:")) return q;
  return `${E5_QUERY_PREFIX}${q}`;
}

export function buildPassageEmbeddingText(input: {
  title: string;
  content: string;
  section?: string | null;
  tags?: string[];
}): string {
  const body = [input.title, input.section?.trim(), ...(input.tags ?? []), input.content]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n")
    .trim();
  if (body.startsWith("passage:")) return body;
  return `${E5_PASSAGE_PREFIX}${body}`;
}

export function assertE5TextWithinTokenLimit(text: string, context: string): void {
  const tokens = estimateEmbeddingTokenCount(text);
  if (tokens > E5_MAX_SEQUENCE_TOKENS) {
    throw new EmbeddingProviderError(
      "EMBEDDING_TOKEN_LIMIT_EXCEEDED",
      `${context}: E5 입력이 ${E5_MAX_SEQUENCE_TOKENS}토큰 제한을 초과했습니다 (추정 ${tokens}토큰). 재분할하거나 Generation을 실패 처리하세요.`,
    );
  }
}

export function assertE5QueryText(query: string): void {
  const text = buildQueryEmbeddingText(query);
  if (!text.startsWith("query:")) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PREFIX_INVALID",
      "E5 query 텍스트에 query: prefix가 필요합니다.",
    );
  }
  assertE5TextWithinTokenLimit(text, "query");
}

export function assertE5PassageText(passage: string): void {
  if (!passage.startsWith("passage:")) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PREFIX_INVALID",
      "E5 passage 텍스트에 passage: prefix가 필요합니다.",
    );
  }
  assertE5TextWithinTokenLimit(passage, "passage");
}

export function validateRetrievalChunkPassageForE5(chunk: {
  id: string;
  title: string;
  content: string;
  section: string | null;
  tags: string[];
}): void {
  const passage = buildPassageEmbeddingText(chunk);
  try {
    assertE5PassageText(passage);
  } catch (error) {
    if (error instanceof EmbeddingProviderError && error.code === "EMBEDDING_TOKEN_LIMIT_EXCEEDED") {
      throw new EmbeddingProviderError(
        "EMBEDDING_TOKEN_LIMIT_EXCEEDED",
        `Chunk ${chunk.id}: ${error.message}`,
      );
    }
    throw error;
  }
}
