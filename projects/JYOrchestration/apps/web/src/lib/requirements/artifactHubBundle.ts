import {
  buildArtifactHubView,
  type ArtifactHubView,
  type ArtifactHubWorkspaceMode,
} from "@/lib/prototype/artifactHubView";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import {
  buildProjectArtifactHubCatalog,
  countCompletedArtifactHubEntries,
  type ProjectArtifactHubEntry,
} from "@/lib/requirements/projectArtifactHub";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import {
  buildArtifactHubOrchestrationState,
  type ArtifactHubOrchestrationState,
} from "@/lib/requirements/requirementsArtifactHubOrchestration";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ArtifactHubBundle = Readonly<{
  readonly catalog: readonly ProjectArtifactHubEntry[];
  readonly view: ArtifactHubView;
  readonly orchestration: ArtifactHubOrchestrationState;
  readonly completedCount: number;
}>;

export function buildArtifactHubBundle(input: {
  readonly mode: ArtifactHubWorkspaceMode;
  readonly state: RequirementsStateJson;
  readonly projectId: string;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly nowMs?: number;
}): ArtifactHubBundle {
  const deliverableAssets = input.deliverableAssets ?? input.state.deliverableAssets ?? [];
  const projectArtifacts = input.projectArtifacts ?? input.state.projectArtifacts ?? [];
  const catalog = buildProjectArtifactHubCatalog({
    state: input.state,
    deliverableAssets,
    projectArtifacts,
  });
  const view = buildArtifactHubView({
    mode: input.mode,
    state: input.state,
    projectId: input.projectId,
    deliverableAssets,
    projectArtifacts,
  });
  const orchestration = buildArtifactHubOrchestrationState({
    state: input.state,
    deliverableAssets,
    projectArtifacts,
    catalog,
    nowMs: input.nowMs,
  });
  return {
    catalog,
    view,
    orchestration,
    completedCount: countCompletedArtifactHubEntries(catalog),
  };
}
