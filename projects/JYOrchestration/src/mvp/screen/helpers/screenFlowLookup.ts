/**
 * MVP — **target** ScreenFlow graph lookups (centralized; no scattered `graph.screens.find`).
 *
 * **Legacy:** N/A — unused when no flow graph exists for a task.
 */

import type { MvpScreen } from "../../domain/mvpDomainTypes";
import type { ScreenFlowGraph } from "../mvpScreenFlowTypes";
import { getNextScreens, getPreviousScreens } from "../mvpScreenFlowMetadata";

export function findScreenById(graph: ScreenFlowGraph, screenId: string): MvpScreen | undefined {
  return graph.screens.find((x) => x.id === screenId);
}

/**
 * First screen with no incoming NAVIGATION edges, when at least one NAVIGATION edge exists.
 * Matches {@link getOrderedScreensFromFlow} entry selection (cycle / malformed → caller fallback).
 */
export function findNavigationEntryScreen(graph: ScreenFlowGraph): MvpScreen | undefined {
  const navEdges = graph.edges.filter((e) => e.type === "NAVIGATION");
  if (navEdges.length === 0) return undefined;
  const incoming = new Map<string, number>();
  for (const s of graph.screens) incoming.set(s.id, 0);
  for (const e of navEdges) {
    incoming.set(e.toScreenId, (incoming.get(e.toScreenId) ?? 0) + 1);
  }
  return graph.screens.find((s) => (incoming.get(s.id) ?? 0) === 0);
}

export function getScreenName(graph: ScreenFlowGraph, screenId: string): string | null {
  const s = findScreenById(graph, screenId);
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
