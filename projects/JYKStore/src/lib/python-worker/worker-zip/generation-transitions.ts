import { prisma } from "@/lib/prisma";
import {
  markSearchGenerationEmbedding,
  markSearchGenerationFailed,
  markSearchGenerationIndexing,
  markSearchGenerationReady,
} from "@/lib/search-generation/search-generation-service";

/** Generation lifecycle transitions, injectable for tests. */
export type WorkerZipGenerationTransitions = {
  toEmbedding: (id: string) => Promise<unknown>;
  toIndexing: (id: string, counts: { embeddedCount: number; chunkCount: number }) => Promise<unknown>;
  toReady: (id: string, counts: { embeddedCount: number; chunkCount: number }) => Promise<unknown>;
  toFailed: (
    id: string,
    failure: { failureCode: string; failureMessage?: string | null },
  ) => Promise<unknown>;
};

export function defaultTransitions(client: typeof prisma): WorkerZipGenerationTransitions {
  return {
    toEmbedding: (id) => markSearchGenerationEmbedding(id, client),
    toIndexing: (id, counts) => markSearchGenerationIndexing(id, counts, client),
    toReady: (id, counts) => markSearchGenerationReady(id, counts, client),
    toFailed: (id, failure) => markSearchGenerationFailed(id, failure, client),
  };
}
