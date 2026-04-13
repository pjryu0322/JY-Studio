/**
 * MVP — Screen flow generation + validation + ordering (preparation only).
 */

import type { MvpScreen } from "../domain/mvpDomainTypes";
import type { ScreenFlowEdge, ScreenFlowGraph } from "./mvpScreenFlowTypes";

function edgeKey(e: Pick<ScreenFlowEdge, "fromScreenId" | "toScreenId" | "type">): string {
  return `${e.type}::${e.fromScreenId}=>${e.toScreenId}`;
}

/**
 * MVP linear inference: sort by `Screen.order` ascending and connect consecutive screens
 * with NAVIGATION edges.
 */
export function generateScreenFlow(screens: readonly MvpScreen[]): ScreenFlowGraph {
  const sorted = [...screens].sort((a, b) => a.order - b.order);
  const edges: ScreenFlowEdge[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const from = sorted[i]!;
    const to = sorted[i + 1]!;
    edges.push({
      id: `edge-nav-${from.projectId}-${i}`,
      projectId: from.projectId,
      fromScreenId: from.id,
      toScreenId: to.id,
      type: "NAVIGATION",
      order: i,
    });
  }
  return { screens: sorted.map((s) => ({ ...s })), edges };
}

export type ScreenFlowValidationResult =
  | { ok: true }
  | {
      ok: false;
      errors: string[];
    };

/**
 * Validates:
 * - all edge endpoints exist
 * - no duplicate edges (same type + from + to)
 * - orphan screens (no incoming AND no outgoing edges) unless only 0/1 screen
 * - cycles for DEPENDENCY edges only
 */
export function validateScreenFlow(graph: ScreenFlowGraph): ScreenFlowValidationResult {
  const errors: string[] = [];
  const screenIds = new Set(graph.screens.map((s) => s.id));

  const seen = new Set<string>();
  for (const e of graph.edges) {
    if (!screenIds.has(e.fromScreenId)) {
      errors.push(`FLOW_EDGE_FROM_MISSING: ${e.id} from=${e.fromScreenId}`);
    }
    if (!screenIds.has(e.toScreenId)) {
      errors.push(`FLOW_EDGE_TO_MISSING: ${e.id} to=${e.toScreenId}`);
    }
    const k = edgeKey(e);
    if (seen.has(k)) {
      errors.push(`FLOW_EDGE_DUPLICATE: ${k}`);
    } else {
      seen.add(k);
    }
  }

  if (graph.screens.length > 1) {
    const degree = new Map<string, { in: number; out: number }>();
    for (const s of graph.screens) {
      degree.set(s.id, { in: 0, out: 0 });
    }
    for (const e of graph.edges) {
      const dFrom = degree.get(e.fromScreenId);
      const dTo = degree.get(e.toScreenId);
      if (dFrom) dFrom.out += 1;
      if (dTo) dTo.in += 1;
    }
    for (const [id, d] of degree) {
      if (d.in === 0 && d.out === 0) {
        errors.push(`FLOW_ORPHAN_SCREEN: ${id}`);
      }
    }
  }

  // Cycle detection for DEPENDENCY subgraph.
  const depEdges = graph.edges.filter((e) => e.type === "DEPENDENCY");
  if (depEdges.length > 0) {
    const adj = new Map<string, string[]>();
    for (const s of graph.screens) {
      adj.set(s.id, []);
    }
    for (const e of depEdges) {
      adj.get(e.fromScreenId)?.push(e.toScreenId);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const hasCycleFrom = (id: string): boolean => {
      if (visited.has(id)) return false;
      if (visiting.has(id)) return true;
      visiting.add(id);
      for (const nxt of adj.get(id) ?? []) {
        if (hasCycleFrom(nxt)) return true;
      }
      visiting.delete(id);
      visited.add(id);
      return false;
    };
    for (const s of graph.screens) {
      if (hasCycleFrom(s.id)) {
        errors.push(`FLOW_DEPENDENCY_CYCLE_DETECTED`);
        break;
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * Returns screens in stable preparation order.
 *
 * MVP behavior:
 * - Uses NAVIGATION edges when present: starts from entry screen (no incoming NAVIGATION),
 *   then follows edges (lowest `order` first if branching).
 * - Falls back to `Screen.order` ascending.
 */
export function getOrderedScreensFromFlow(graph: ScreenFlowGraph): MvpScreen[] {
  const screensById = new Map(graph.screens.map((s) => [s.id, s]));
  const navEdges = graph.edges.filter((e) => e.type === "NAVIGATION");
  if (navEdges.length === 0) {
    return [...graph.screens].sort((a, b) => a.order - b.order).map((s) => ({ ...s }));
  }

  const incoming = new Map<string, number>();
  for (const s of graph.screens) incoming.set(s.id, 0);
  for (const e of navEdges) {
    incoming.set(e.toScreenId, (incoming.get(e.toScreenId) ?? 0) + 1);
  }
  const entry = graph.screens.find((s) => (incoming.get(s.id) ?? 0) === 0);
  if (!entry) {
    // No entry means a cycle or malformed graph; fallback deterministically.
    return [...graph.screens].sort((a, b) => a.order - b.order).map((s) => ({ ...s }));
  }

  const edgesFrom = new Map<string, ScreenFlowEdge[]>();
  for (const e of navEdges) {
    const list = edgesFrom.get(e.fromScreenId) ?? [];
    list.push(e);
    edgesFrom.set(e.fromScreenId, list);
  }
  for (const [k, list] of edgesFrom) {
    edgesFrom.set(
      k,
      [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
    );
  }

  const out: MvpScreen[] = [];
  const seen = new Set<string>();
  let current: string | undefined = entry.id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const s = screensById.get(current);
    if (s) out.push({ ...s });
    const next = edgesFrom.get(current)?.[0]?.toScreenId;
    current = next;
  }

  // Append any remaining screens deterministically.
  for (const s of [...graph.screens].sort((a, b) => a.order - b.order)) {
    if (!seen.has(s.id)) out.push({ ...s });
  }
  return out;
}

