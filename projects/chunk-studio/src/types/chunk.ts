export interface Chunk {
    id: string;
    content: string;
    tokenCount: number;
    metadata?: Record<string, unknown>;
  }