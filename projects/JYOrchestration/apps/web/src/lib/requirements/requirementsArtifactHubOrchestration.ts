/**
 * Artifact Hub orchestration linkage — badge/count/stale hints from state.
 */

import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildProjectArtifactHubCatalog } from "@/lib/requirements/projectArtifactHub";
import { projectFeatureDetailMetrics } from "@/lib/requirements/featureDetailSlots";

export type ArtifactHubOrchestrationState = Readonly<{
  readonly totalCount: number;
  readonly generatableCount: number;
  readonly staleArtifactCount: number;
  readonly hasStaleArtifact: boolean;
  readonly hasRecentUpdate: boolean;
  readonly badgeEligible: boolean;
  readonly badgeHint?: string;
}>;

export function artifactHubTopChromeBadgeCount(
  catalogCount: number,
  hub: ArtifactHubOrchestrationState,
): number {
  if (!hub.badgeEligible) return 0;
  return Math.max(catalogCount, hub.generatableCount);
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function buildArtifactHubOrchestrationState(input: {
  readonly state: RequirementsStateJson;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly nowMs?: number;
}): ArtifactHubOrchestrationState {
  const catalog = buildProjectArtifactHubCatalog({
    state: input.state,
    deliverableAssets: input.deliverableAssets,
    projectArtifacts: input.projectArtifacts,
  });
  const metrics = projectFeatureDetailMetrics(input.state.featureDetailSlotsV1);
  const now = input.nowMs ?? Date.now();
  let hasStale = false;
  let hasRecent = false;
  let staleArtifactCount = 0;
  for (const entry of catalog) {
    const t = Date.parse(entry.createdAt);
    if (!Number.isFinite(t)) continue;
    if (now - t > STALE_MS) {
      hasStale = true;
      staleArtifactCount += 1;
    }
    if (now - t < 48 * 60 * 60 * 1000) hasRecent = true;
  }

  const generatableCount = metrics.hasConfirmedFeature ? Math.max(1, catalog.length) : 0;
  const badgeEligible = generatableCount > 0 || catalog.length > 0;

  return {
    totalCount: catalog.length,
    generatableCount,
    staleArtifactCount,
    hasStaleArtifact: hasStale,
    hasRecentUpdate: hasRecent,
    badgeEligible,
    badgeHint:
      metrics.hasConfirmedFeature ?
        catalog.length ?
          `산출물 ${catalog.length}건 · Artifact Hub에서 문서·보내기를 진행할 수 있습니다.`
        : "기능이 확정되었습니다 — Artifact Hub에서 문서를 생성할 수 있습니다."
      : undefined,
  };
}
