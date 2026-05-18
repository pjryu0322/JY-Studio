/**
 * MVP — in-memory Requirement store for domain generation tests and future wiring.
 */

import type { MvpRequirement } from "../mvpDomainTypes";

const byProject = new Map<string, MvpRequirement[]>();

export function mvpSeedProjectRequirements(projectId: string, requirements: MvpRequirement[]): void {
  byProject.set(
    projectId,
    requirements.map((r) => ({ ...r, projectId }))
  );
}

export function mvpListProjectRequirements(projectId: string): readonly MvpRequirement[] {
  return [...(byProject.get(projectId) ?? [])].map((r) => ({ ...r }));
}

export function mvpClearRequirementStore(): void {
  byProject.clear();
}

