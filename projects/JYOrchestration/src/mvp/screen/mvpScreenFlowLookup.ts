/**
 * MVP — compatibility re-exports for `screen/helpers/screenFlowLookup`.
 *
 * **Target:** import from `screen/helpers/screenFlowLookup` in new code.
 */

export {
  getScreenName as getScreenNameById,
  getScreenName,
  getPreviousScreenNames,
  getNextScreenNames,
  mapScreenIdsToNames,
} from "./helpers/screenFlowLookup";
