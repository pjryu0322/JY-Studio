/**
 * Provider "검색검증" SearchData UI state model (public facade).
 * Legacy local-hash pipeline PASS is never treated as current Local E5 search data.
 *
 * Implementation lives in:
 * - search-data-state-types.ts
 * - search-data-state-policy.ts
 * - search-data-state-ui.ts
 * - search-data-state-response.ts
 */

export type {
  SearchDataUiState,
  SearchDataStatusResponse,
  SearchDataStatusInput,
} from "@/lib/search-data/search-data-state-types";

export {
  isScaffoldGeneration,
  isRunningGeneration,
  isLocalE5Complete,
  computeSearchDataUiState,
  canGenerateSearchData,
  canValidateSearchDataState,
  canRunServiceValidationForSearchData,
  isSearchDataRankingPolicyStale,
} from "@/lib/search-data/search-data-state-policy";

export {
  searchDataTabStatusLabel,
  resolveSearchDataStatusMessage,
  searchDataModelLabel,
} from "@/lib/search-data/search-data-state-ui";

export { buildSearchDataStatusResponse } from "@/lib/search-data/search-data-state-response";
