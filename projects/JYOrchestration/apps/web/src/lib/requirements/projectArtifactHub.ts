/**
 * Artifact Hub — project orchestration state 기반 산출물 카탈로그 (not messageId).
 */

import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { PROJECT_ARTIFACT_LABELS, type ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";

export type ArtifactHubEntryKind = "project-artifact" | "deliverable";

export type ProjectArtifactHubEntry = Readonly<{
  readonly id: string;
  readonly kind: ArtifactHubEntryKind;
  readonly artifactType: ProjectArtifactType | "deliverable";
  readonly title: string;
  readonly sourceStage: string;
  readonly createdAt: string;
  readonly assetId: string;
}>;

export function buildProjectArtifactHubCatalog(input: {
  readonly state: RequirementsStateJson;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
}): readonly ProjectArtifactHubEntry[] {
  const sourceStage = resolveAuthoritativeOrchestrationStage(input.state);
  const out: ProjectArtifactHubEntry[] = [];

  for (const art of input.projectArtifacts ?? []) {
    out.push({
      id: `artifact-${art.id}`,
      kind: "project-artifact",
      artifactType: art.type,
      title: PROJECT_ARTIFACT_LABELS[art.type] ?? art.title,
      sourceStage: art.sourceStage,
      createdAt: art.createdAt,
      assetId: art.id,
    });
  }

  for (const asset of input.deliverableAssets ?? []) {
    out.push({
      id: `deliverable-${asset.id}`,
      kind: "deliverable",
      artifactType: "deliverable",
      title: asset.title,
      sourceStage: "IDEATION",
      createdAt: asset.createdAt,
      assetId: asset.id,
    });
  }

  if (!out.length && sourceStage) {
    return out;
  }

  return [...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
