/**
 * Artifact version lineage — track versions for Hub compare/regenerate UX.
 */

import { computeOrchestrationSourceHash } from "@/lib/requirements/requirementsArtifactLifecycle";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { ArtifactLifecycleEntryWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";

function versionIdFromHash(hash: string, stage: string): string {
  const slice = hash.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  return `av-${stage}-${slice || "root"}`;
}

export function buildArtifactVersionLineage(input: {
  readonly state: RequirementsStateJson;
  readonly stage: OrchestrationStage;
  readonly prev?: readonly ArtifactLifecycleEntryWire[];
  readonly nowIso?: string;
}): readonly ArtifactLifecycleEntryWire[] {
  const hash = computeOrchestrationSourceHash(input.state);
  const now = input.nowIso ?? new Date().toISOString();
  const versionId = versionIdFromHash(hash, input.stage);
  const prevHead = input.prev?.find((e) => e.artifactKey === "project-artifacts");
  const parentId =
    prevHead && prevHead.generatedFromStateHash !== hash ? prevHead.artifactVersionId : undefined;

  const stale = Boolean(parentId);
  const entries: ArtifactLifecycleEntryWire[] = [];

  if (stale && prevHead) {
    entries.push({ ...prevHead, stale: true, staleReason: "superseded" });
  }

  entries.push({
    artifactKey: "project-artifacts",
    artifactVersionId: versionId,
    ...(parentId ? { parentArtifactVersionId: parentId } : {}),
    generatedFromStateHash: hash,
    generatedFromStage: input.stage,
    generated: (input.state.projectArtifacts?.length ?? 0) > 0,
    stale: false,
    sourceStage: input.stage,
    sourceHash: hash,
    generatedAt: (input.state.projectArtifacts?.length ?? 0) > 0 ? now : undefined,
    updatedAt: now,
    lineageLabel: parentId ? "regenerate" : "latest",
  });

  return entries.slice(-32);
}

export function artifactLineageLabelKo(entry: ArtifactLifecycleEntryWire): string {
  if (entry.lineageLabel === "regenerate") return "재생성 필요";
  if (entry.stale) return "구버전";
  if (entry.parentArtifactVersionId) return "이전본";
  if (entry.generated) return "최신본";
  return "생성 가능";
}
