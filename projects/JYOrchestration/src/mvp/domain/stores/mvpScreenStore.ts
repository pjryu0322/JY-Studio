/**
 * MVP — in-memory Screen store for prompt context lookup.
 */

import type { MvpScreen } from "../mvpDomainTypes";

const byProject = new Map<string, MvpScreen[]>();
const byId = new Map<string, MvpScreen>();

export function mvpSeedProjectScreens(projectId: string, screens: MvpScreen[]): void {
  const prev = byProject.get(projectId) ?? [];
  for (const s of prev) {
    byId.delete(s.id);
  }
  const next = screens.map((s) => ({ ...s, projectId }));
  byProject.set(projectId, next);
  for (const s of next) {
    byId.set(s.id, s);
  }
}

export function mvpGetScreenById(screenId: string): MvpScreen | undefined {
  const s = byId.get(screenId);
  return s ? { ...s } : undefined;
}

export function mvpListProjectScreens(projectId: string): readonly MvpScreen[] {
  return [...(byProject.get(projectId) ?? [])].map((s) => ({ ...s }));
}

export function mvpClearScreenStore(): void {
  byProject.clear();
  byId.clear();
}

