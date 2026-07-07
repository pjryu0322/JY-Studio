import crypto from "crypto";
import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
  type EmbeddingInput,
  type EmbeddingProvider,
  type EmbeddingResult,
} from "@/lib/embedding-dto";
import { tokenizeSearchQuery } from "@/lib/search-utils";

// local-hash embedding: 외부 호출 없이 deterministic vector를 생성하는 개발/foundation provider입니다.
// 운영 품질의 semantic embedding이 아니며, 향후 external provider로 교체 가능한 형태입니다.

function hashToInt(token: string, salt: string): number {
  const hash = crypto.createHash("sha256").update(`${salt}:${token}`).digest();
  // 앞 4바이트를 부호 없는 32bit 정수로 사용
  return hash.readUInt32BE(0);
}

function l2Normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const value of vector) sumSquares += value * value;
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export function embedTextLocalHash(text: string, dimension: number): number[] {
  const vector = new Array<number>(dimension).fill(0);
  const tokens = tokenizeSearchQuery(text);
  if (tokens.length === 0) {
    // 빈 text는 zero vector로 일관 처리한다.
    return vector;
  }

  for (const token of tokens) {
    const bucket = hashToInt(token, "bucket") % dimension;
    const sign = hashToInt(token, "sign") % 2 === 0 ? 1 : -1;
    vector[bucket] += sign;
  }

  return l2Normalize(vector);
}

export const localEmbeddingProvider: EmbeddingProvider = {
  id: DEFAULT_EMBEDDING_PROVIDER,
  model: DEFAULT_EMBEDDING_MODEL,
  dimension: DEFAULT_EMBEDDING_DIMENSION,
  embed(input: EmbeddingInput): EmbeddingResult {
    const dimension = input.dimension ?? DEFAULT_EMBEDDING_DIMENSION;
    return {
      provider: DEFAULT_EMBEDDING_PROVIDER,
      model: DEFAULT_EMBEDDING_MODEL,
      dimension,
      vector: embedTextLocalHash(input.text, dimension),
    };
  },
};
