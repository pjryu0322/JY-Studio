/**
 * Build result DTO for ND → KU → Chunk pipeline.
 */
import type { ExclusionReasonMap } from "@/lib/docling-knowledge/docling-knowledge-unit-plan";
import type { PassageTokenGateSummary } from "@/lib/docling-knowledge/token-aware-chunk-split";
import type { buildLocalE5EmbeddingProfile } from "@/lib/embedding/e5-tokenize-client";

export type DoclingKnowledgeBuildResult = {
  unitCount: number;
  chunkCount: number;
  excludedCount: number;
  mergedCount: number;
  shortSectionMergedCount: number;
  shortValidUnitCount: number;
  stepStatus: "PASS" | "WARNING" | "FAIL";
  warnings: string[];
  byType: Record<string, number>;
  indexGenerationId: string;
  coverage: {
    sourceChars: number;
    unitChars: number;
    chunkChars: number;
    excludedChars: number;
    rawBodyChars: number;
    eligibleBodyChars: number;
    unitBodyChars: number;
    normalExcludedBodyChars: number;
    criticalExcludedBodyChars: number;
    rawBodyCoverage: number;
    eligibleBodyCoverage: number;
    /** Alias of eligibleBodyCoverage for backward-compatible UI. */
    bodyCoverage: number;
    tableCoverage: number;
    figureCoverage: number;
    provenanceMissing: number;
    exclusionReasons: ExclusionReasonMap;
  };
  sampleUnits: Array<{ title: string; unitType: string; preview: string }>;
  sampleChunks: Array<{ title: string; preview: string; length: number }>;
  tokenGate: PassageTokenGateSummary;
  tokenGateStatus: "PASS" | "WARNING" | "FAIL";
  embeddingProfile: ReturnType<typeof buildLocalE5EmbeddingProfile>;
  failureCode?: string;
};
