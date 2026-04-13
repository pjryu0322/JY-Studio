/**
 * MVP — in-memory ScreenFlow store (preparation/runtime prompt context only).
 */

import type { ScreenFlowGraph } from "../mvpScreenFlowTypes";

const byProject = new Map<string, ScreenFlowGraph>();

export function mvpSeedProjectScreenFlow(projectId: string, graph: ScreenFlowGraph): void {
  byProject.set(projectId, {
    screens: graph.screens.map((s) => ({ ...s })),
    edges: graph.edges.map((e) => ({ ...e })),
  });
}

export function mvpGetProjectScreenFlow(projectId: string): ScreenFlowGraph | null {
  const g = byProject.get(projectId);
  if (!g) return null;
  return { screens: g.screens.map((s) => ({ ...s })), edges: g.edges.map((e) => ({ ...e })) };
}

export function mvpClearScreenFlowStore(): void {
  byProject.clear();
}

