/**
 * Artifact Hub — project orchestration state 기반 산출물 카탈로그 (not messageId).
 */

import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import { LEGACY_QUICK_DESIGN_AREA_TITLES } from "@/lib/requirements/projectArtifactPlan";
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

/** Artifact Hub에 표시할 완성(저장) 산출물 건수 — 카탈로그 항목 수와 동일 */
export function countCompletedArtifactHubEntries(
  catalog: readonly ProjectArtifactHubEntry[],
): number {
  return catalog.length;
}

export function buildProjectArtifactHubCatalog(input: {
  readonly state: RequirementsStateJson;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
}): readonly ProjectArtifactHubEntry[] {
  const byAssetId = new Map<string, ProjectArtifactHubEntry>();

  for (const art of input.projectArtifacts ?? []) {
    const assetId = String(art.id ?? "").trim();
    if (!assetId) continue;
    const title = String(art.title ?? "").trim() || PROJECT_ARTIFACT_LABELS[art.type] || art.type;
    if (LEGACY_QUICK_DESIGN_AREA_TITLES.has(title)) continue;
    byAssetId.set(assetId, {
      id: `artifact-${assetId}`,
      kind: "project-artifact",
      artifactType: art.type,
      title,
      sourceStage: art.sourceStage,
      createdAt: art.createdAt,
      assetId,
    });
  }

  for (const asset of input.deliverableAssets ?? []) {
    const assetId = String(asset.id ?? "").trim();
    if (!assetId || byAssetId.has(assetId)) continue;
    const title = String(asset.title ?? "").trim() || "산출물";
    if (LEGACY_QUICK_DESIGN_AREA_TITLES.has(title)) continue;
    byAssetId.set(assetId, {
      id: `deliverable-${assetId}`,
      kind: "deliverable",
      artifactType: "deliverable",
      title,
      sourceStage: resolveAuthoritativeOrchestrationStage(input.state) || "IDEATION",
      createdAt: asset.createdAt,
      assetId,
    });
  }

  return [...byAssetId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
