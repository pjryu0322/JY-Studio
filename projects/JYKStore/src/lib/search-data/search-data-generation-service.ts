/**
 * Thin facade — public API for search-data generation orchestration.
 * Implementation lives in split modules under this directory.
 */

export { provisionalEnqueueLocalE5Descriptor, searchDataStaleSeconds, __testOnlyIsLocalE5Generation } from "@/lib/search-data/search-data-generation-policy";
export type { SearchDataGenerateAccepted, ClaimedSearchDataGeneration } from "@/lib/search-data/search-data-generation-types";
export { getSearchDataStatus } from "@/lib/search-data/search-data-generation-status";
export { startSearchDataGeneration } from "@/lib/search-data/search-data-generation-enqueue";
export {
  recoverOneStaleSearchDataGeneration,
  claimNextSearchDataGeneration,
  processSearchDataGenerationJob,
} from "@/lib/search-data/search-data-generation-worker";
export { validateSearchData } from "@/lib/search-data/search-data-generation-evaluation";
