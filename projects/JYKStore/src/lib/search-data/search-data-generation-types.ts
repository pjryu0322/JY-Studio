export const SEARCH_DATA_LOCK_KEY = (packId: string) => `search-data:${packId}`;

export const DEFAULT_STALE_SECONDS = 300;
export const PINNED_E5_REVISION = "fcfc26bf355882620c48df58be112275bd756f50";

export type SearchDataGenerateAccepted = {
  accepted: true;
  state: "CREATING";
  searchIndexGenerationId: string;
  processedCount: number;
  chunkCount: number;
};

export type ClaimedSearchDataGeneration = {
  id: string;
  packId: string;
  versionId: string;
  pipelineRunId: string;
  attempt: number;
  chunkGenerationId: string;
  normalizedDocumentId: string;
  fingerprint: string;
  chunkCount: number;
};
