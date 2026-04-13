/**
 * MVP — internal screen flow metadata helpers (preparation only).
 */

import type { ScreenFlowEdge, ScreenFlowGraph } from "./mvpScreenFlowTypes";

function outgoingEdges(graph: ScreenFlowGraph, screenId: string): ScreenFlowEdge[] {
  return graph.edges.filter((e) => e.fromScreenId === screenId);
}

function incomingEdges(graph: ScreenFlowGraph, screenId: string): ScreenFlowEdge[] {
  return graph.edges.filter((e) => e.toScreenId === screenId);
}

export function getNextScreens(graph: ScreenFlowGraph, screenId: string): string[] {
  return outgoingEdges(graph, screenId)
    .filter((e) => e.type === "NAVIGATION")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
    .map((e) => e.toScreenId);
}

export function getPreviousScreens(graph: ScreenFlowGraph, screenId: string): string[] {
  return incomingEdges(graph, screenId)
    .filter((e) => e.type === "NAVIGATION")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
    .map((e) => e.fromScreenId);
}

export function isEntryScreen(graph: ScreenFlowGraph, screenId: string): boolean {
  return getPreviousScreens(graph, screenId).length === 0;
}

/**
 * Depth from an entry screen via NAVIGATION edges.
 * Returns null when the screen is unreachable from any entry (malformed graph).
 */
export function getScreenDepth(graph: ScreenFlowGraph, screenId: string): number | null {
  const entries = graph.screens.filter((s) => isEntryScreen(graph, s.id)).map((s) => s.id);
  if (entries.length === 0) return null;
  const q: Array<{ id: string; d: number }> = entries.map((id) => ({ id, d: 0 }));
  const seen = new Set<string>();
  while (q.length > 0) {
    const cur = q.shift()!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    if (cur.id === screenId) return cur.d;
    for (const nxt of getNextScreens(graph, cur.id)) {
      q.push({ id: nxt, d: cur.d + 1 });
    }
  }
  return null;
}

