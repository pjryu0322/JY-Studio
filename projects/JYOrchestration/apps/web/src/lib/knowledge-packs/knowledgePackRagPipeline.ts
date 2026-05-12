/**
 * RAG 파이프라인 경계(Stub). 실제 URL fetch·파싱·임베딩·벡터 저장은 구현하지 않는다.
 */

export type KnowledgePackSourceCollectionResult = Readonly<{
  sourceId: string;
  status: "PENDING" | "READY" | "FAILED";
  content?: string;
  message?: string;
}>;

export type KnowledgePackChunk = Readonly<{
  id: string;
  knowledgePackId: string;
  sourceId: string;
  text: string;
  order: number;
  tokenEstimate?: number;
}>;

export type KnowledgePackEmbeddingRecord = Readonly<{
  id: string;
  chunkId: string;
  provider: string;
  model: string;
  vector?: readonly number[];
  createdAt?: string;
}>;

export type KnowledgePackRagIndexStatus =
  | "NOT_INDEXED"
  | "SOURCE_READY"
  | "PARSED"
  | "CHUNKED"
  | "EMBEDDED"
  | "INDEXED"
  | "FAILED";

export type CollectKnowledgePackSourceStubInput = Readonly<{
  knowledgePackId: string;
  urlHint?: string;
}>;

/** 실제 HTTP fetch 없음 — 후속 단계용 식별자·상태만 반환. */
export async function collectKnowledgePackSourceStub(
  input: CollectKnowledgePackSourceStubInput
): Promise<KnowledgePackSourceCollectionResult> {
  const sourceId = `stub_src_${input.knowledgePackId}`;
  return {
    sourceId,
    status: "PENDING",
    message: "Stub: 원천자료 URL 수집 미구현(외부 fetch 없음)",
  };
}

export type ChunkKnowledgePackTextStubInput = Readonly<{
  knowledgePackId: string;
  sourceId: string;
  text: string;
  maxChunkChars?: number;
}>;

/** 긴 텍스트를 고정 길이 청크로 분할(로컬만, 네트워크 없음). */
export function chunkKnowledgePackTextStub(input: ChunkKnowledgePackTextStubInput): KnowledgePackChunk[] {
  const max = Math.max(32, Math.floor(input.maxChunkChars ?? 500));
  const text = input.text;
  if (!text.length) {
    return [
      {
        id: `${input.knowledgePackId}_${input.sourceId}_chunk_0`,
        knowledgePackId: input.knowledgePackId,
        sourceId: input.sourceId,
        text: "",
        order: 0,
        tokenEstimate: 0,
      },
    ];
  }
  const chunks: KnowledgePackChunk[] = [];
  for (let i = 0, order = 0; i < text.length; i += max, order += 1) {
    const slice = text.slice(i, i + max);
    chunks.push({
      id: `${input.knowledgePackId}_${input.sourceId}_chunk_${order}`,
      knowledgePackId: input.knowledgePackId,
      sourceId: input.sourceId,
      text: slice,
      order,
      tokenEstimate: Math.ceil(slice.length / 4),
    });
  }
  return chunks;
}

/** 실제 임베딩 API 호출 없음. */
export async function createKnowledgePackEmbeddingStub(
  chunks: readonly KnowledgePackChunk[],
  _opts?: Readonly<{ provider?: string; model?: string }>
): Promise<KnowledgePackEmbeddingRecord[]> {
  return chunks.map((c) => ({
    id: `emb_stub_${c.id}`,
    chunkId: c.id,
    provider: "STUB",
    model: "not-implemented",
    vector: undefined,
    createdAt: undefined,
  }));
}

/** 실제 벡터 DB 저장 없음. */
export async function saveKnowledgePackVectorsStub(
  _records: readonly KnowledgePackEmbeddingRecord[]
): Promise<{ status: "NOT_IMPLEMENTED" }> {
  return { status: "NOT_IMPLEMENTED" };
}
