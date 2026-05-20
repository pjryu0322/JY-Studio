/**
 * Artifact lifecycle — stale when underlying flow/feature source changes.
 */

import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { MAX_ARTIFACT_LIFECYCLE_ENTRIES } from "@/lib/requirements/requirementsOrchestrationConstants";
import type { ArtifactLifecycleEntryWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";

export function computeOrchestrationSourceHash(state: RequirementsStateJson): string {
  const flowAt = state.serviceFlowV1?.updatedAt ?? "";
  const slots =
    state.featureDetailSlotsV1?.slots
      .map((s) => `${s.id}:${s.status}:${s.updatedAt}`)
      .sort()
      .join(";") ?? "";
  const stage = state.requirementsOrchestrationStageV1?.activePhase ?? "";
  return `${stage}|${flowAt}|${slots}`.slice(0, 240);
}

export function buildArtifactLifecycleEntries(input: {
  readonly state: RequirementsStateJson;
  readonly stage: OrchestrationStage;
  readonly prev?: readonly ArtifactLifecycleEntryWire[];
  readonly nowIso?: string;
}): readonly ArtifactLifecycleEntryWire[] {
  const sourceHash = computeOrchestrationSourceHash(input.state);
  const now = input.nowIso ?? new Date().toISOString();
  const prevHash = input.prev?.[0]?.sourceHash;
  const sourceChanged = Boolean(prevHash && prevHash !== sourceHash);

  const entries: ArtifactLifecycleEntryWire[] = [];
  if (sourceChanged) {
    for (const p of input.prev ?? []) {
      entries.push({
        ...p,
        stale: true,
        staleReason: "source_changed",
      });
    }
  }

  entries.push({
    artifactKey: "project-artifacts",
    generated: (input.state.projectArtifacts?.length ?? 0) > 0,
    stale: sourceChanged,
    sourceStage: input.stage,
    sourceHash,
    generatedAt: sourceChanged ? undefined : (input.prev?.[entries.length - 1]?.generatedAt ?? now),
    updatedAt: now,
  });

  return entries.slice(-MAX_ARTIFACT_LIFECYCLE_ENTRIES);
}

export function artifactLifecycleHasStale(entries: readonly ArtifactLifecycleEntryWire[] | undefined): boolean {
  return entries?.some((e) => e.stale) === true;
}
