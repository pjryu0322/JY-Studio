import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import type { ProjectArtifact, ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";

export type ArtifactStage = "planning" | "implementation" | "review" | "scm";

export type ArtifactHubStageFilter = "all" | "planning" | "implementation" | "review" | "scm";

export type ArtifactHubSection = "implementation-primary" | "planning-reference" | "planning-primary";

const PLANNING_ARTIFACT_TYPES: ReadonlySet<ProjectArtifactType> = new Set([
  "summary",
  "service-flow-doc",
  "feature-spec",
  "screen-spec",
  "api-spec",
  "fast_prototype_plan",
]);

const PLANNING_REFERENCE_TYPES: ReadonlySet<ProjectArtifactType> = new Set([
  "feature-spec",
  "screen-spec",
  "api-spec",
  "service-flow-doc",
  "fast_prototype_plan",
]);

export const ARTIFACT_HUB_STAGE_FILTER_LABELS: Record<ArtifactHubStageFilter, string> = {
  all: "전체",
  planning: "기획",
  implementation: "구현",
  review: "검수",
  scm: "SCM",
};

/** MVP 노출 탭 */
export const ARTIFACT_HUB_VISIBLE_STAGE_FILTERS: readonly ArtifactHubStageFilter[] = [
  "all",
  "planning",
  "implementation",
];

export function defaultArtifactHubStageFilter(
  mode: "planning" | "implementation",
): ArtifactHubStageFilter {
  return mode === "implementation" ? "implementation" : "planning";
}

export function getProjectArtifactStage(artifact: Pick<ProjectArtifact, "type">): ArtifactStage {
  if (PLANNING_ARTIFACT_TYPES.has(artifact.type)) return "planning";
  return "planning";
}

export function isPlanningReferenceArtifactType(type: ProjectArtifactType | string): boolean {
  return PLANNING_REFERENCE_TYPES.has(type as ProjectArtifactType);
}

export function getHubEntryStage(entry: ProjectArtifactHubEntry): ArtifactStage {
  if (entry.artifactStage) return entry.artifactStage;
  if (entry.kind === "deliverable") return "planning";
  if (isPlanningReferenceArtifactType(entry.artifactType)) return "planning";
  return "planning";
}

export function getHubEntrySection(entry: ProjectArtifactHubEntry): ArtifactHubSection {
  if (entry.hubSection) return entry.hubSection;
  return "planning-primary";
}

export function filterArtifactHubEntriesByStage(
  entries: readonly ProjectArtifactHubEntry[],
  filter: ArtifactHubStageFilter,
): readonly ProjectArtifactHubEntry[] {
  if (filter === "all") return entries;
  return entries.filter((e) => getHubEntryStage(e) === filter);
}

export function countArtifactHubEntriesByStage(
  entries: readonly ProjectArtifactHubEntry[],
): Readonly<Record<ArtifactHubStageFilter, number>> {
  const counts: Record<ArtifactHubStageFilter, number> = {
    all: entries.length,
    planning: 0,
    implementation: 0,
    review: 0,
    scm: 0,
  };
  for (const e of entries) {
    const stage = getHubEntryStage(e);
    counts[stage] += 1;
  }
  return counts;
}
