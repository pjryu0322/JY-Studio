/**
 * MVP — **target** ScreenFlow graph lookups (centralized; no scattered `graph.screens.find`).
 *
 * **Legacy:** N/A — unused when no flow graph exists for a task.
 */

import type { ScreenFlowGraph } from "../mvpScreenFlowTypes";
import { getNextScreens, getPreviousScreens } from "../mvpScreenFlowMetadata";

export function getScreenName(graph: ScreenFlowGraph, screenId: string): string | null {
  const s = graph.screens.find((x) => x.id === screenId);
  return s?.name != null && String(s.name).trim() !== "" ? s.name : null;
}

export function mapScreenIdsToNames(graph: ScreenFlowGraph, screenIds: readonly string[]): string[] {
  return screenIds
    .map((id) => getScreenName(graph, id))
    .filter((x): x is string => typeof x === "string" && x.length > 0);
}

export function getPreviousScreenNames(screenId: string, graph: ScreenFlowGraph): string[] {
  return mapScreenIdsToNames(graph, getPreviousScreens(graph, screenId));
}

export function getNextScreenNames(screenId: string, graph: ScreenFlowGraph): string[] {
  return mapScreenIdsToNames(graph, getNextScreens(graph, screenId));
}
