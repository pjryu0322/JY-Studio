/** `POST /api/knowledge-packs/retrieve-context` 성공 본문의 `chunks[]` 한 행 (클라이언트 표시용). */
export type KnowledgePackRetrieveContextChunkRow = Readonly<{
  chunkId: string;
  score: number;
  sourceTitle: string;
  sourceUrl?: string | null;
  excerpt: string;
}>;

export type KnowledgePackRetrieveContextApiOk = Readonly<{
  ok: true;
  mode?: string;
  knowledgePackId?: string;
  query?: string;
  chunks?: KnowledgePackRetrieveContextChunkRow[];
  promptContext?: string[];
  diagnostics?: string[];
}>;

export type KnowledgePackRetrieveContextApiErr = Readonly<{ ok: false; message?: string }>;
