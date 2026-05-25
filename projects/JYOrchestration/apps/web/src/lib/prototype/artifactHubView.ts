import {
  countArtifactHubEntriesByStage,
  defaultArtifactHubStageFilter,
  isPlanningReferenceArtifactType,
  type ArtifactHubSection,
  type ArtifactHubStageFilter,
} from "@/lib/prototype/artifactHubStage";
import {
  buildDerivedImplementationArtifacts,
  derivedImplementationArtifactToHubEntry,
} from "@/lib/prototype/implementationArtifacts";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import {
  buildProjectArtifactHubCatalog,
  type ProjectArtifactHubEntry,
} from "@/lib/requirements/projectArtifactHub";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ArtifactHubWorkspaceMode = "planning" | "implementation";

export type ArtifactHubView = Readonly<{
  readonly mode: ArtifactHubWorkspaceMode;
  readonly defaultStageFilter: ArtifactHubStageFilter;
  readonly showStageFilters: boolean;
  readonly entries: readonly ProjectArtifactHubEntry[];
  readonly stageCounts: Readonly<Record<ArtifactHubStageFilter, number>>;
  readonly implementationPrimary: readonly ProjectArtifactHubEntry[];
  readonly planningPrimary: readonly ProjectArtifactHubEntry[];
  readonly planningReference: readonly ProjectArtifactHubEntry[];
  readonly badgeCount: number;
  readonly derivedTypes: readonly string[];
}>;

function tagPlanningEntry(
  entry: ProjectArtifactHubEntry,
  section: ArtifactHubSection,
): ProjectArtifactHubEntry {
  return {
    ...entry,
    artifactStage: "planning",
    hubSection: section,
  };
}

export function buildArtifactHubView(input: {
  readonly mode: ArtifactHubWorkspaceMode;
  readonly state: RequirementsStateJson;
  readonly projectId: string;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
}): ArtifactHubView {
  const deliverables = input.deliverableAssets ?? input.state.deliverableAssets ?? [];
  const artifacts = input.projectArtifacts ?? input.state.projectArtifacts ?? [];
  const planningCatalog = buildProjectArtifactHubCatalog({
    state: input.state,
    deliverableAssets: deliverables,
    projectArtifacts: artifacts,
  }).map((e) => tagPlanningEntry(e, "planning-primary"));

  if (input.mode === "planning") {
    const stageCounts = countArtifactHubEntriesByStage(planningCatalog);
    return {
      mode: "planning",
      defaultStageFilter: defaultArtifactHubStageFilter("planning"),
      showStageFilters: true,
      entries: planningCatalog,
      stageCounts,
      implementationPrimary: [],
      planningPrimary: planningCatalog,
      planningReference: [],
      badgeCount: planningCatalog.length,
      derivedTypes: [],
    };
  }

  const derived = buildDerivedImplementationArtifacts({
    projectId: input.projectId.trim(),
    implementationTaskPlanV1: input.state.implementationTaskPlanV1,
    implementationSlotsV1: input.state.implementationSlotsV1,
    implementationDbStrategyV1: input.state.implementationDbStrategyV1,
    projectArtifacts: input.projectArtifacts,
    cursorWorkItemsV1: input.state.cursorWorkItemsV1,
    codeAgentWipExecutionV1: input.state.codeAgentWipExecutionV1,
  });
  const implementationPrimary = derived.map(derivedImplementationArtifactToHubEntry);

  const planningReference = planningCatalog.filter((e) => {
    if (e.kind === "deliverable") {
      const t = e.title.toLowerCase();
      return /기능|화면|api|프로토|흐름|feature|screen/i.test(t);
    }
    return isPlanningReferenceArtifactType(String(e.artifactType));
  }).map((e) => tagPlanningEntry(e, "planning-reference"));

  const entries = [...implementationPrimary, ...planningReference];
  const stageCounts = countArtifactHubEntriesByStage([
    ...implementationPrimary,
    ...planningCatalog,
  ]);

  return {
    mode: "implementation",
    defaultStageFilter: defaultArtifactHubStageFilter("implementation"),
    showStageFilters: true,
    entries,
    stageCounts,
    implementationPrimary,
    planningPrimary: planningCatalog,
    planningReference,
    badgeCount: entries.length,
    derivedTypes: derived.map((d) => d.type),
  };
}

export function groupArtifactHubEntriesForDisplay(
  view: ArtifactHubView,
  filter: ArtifactHubStageFilter,
): Readonly<{
  readonly sections: readonly Readonly<{
    readonly title: string;
    readonly entries: readonly ProjectArtifactHubEntry[];
  }>[];
}> {
  if (view.mode === "planning" || filter === "planning") {
    const entries = filter === "all" && view.mode === "planning" ? view.entries : view.planningPrimary;
    return { sections: [{ title: "기획 산출물", entries }] };
  }

  if (filter === "all") {
    const sections: { title: string; entries: ProjectArtifactHubEntry[] }[] = [];
    if (view.implementationPrimary.length) {
      sections.push({ title: "구현 산출물", entries: [...view.implementationPrimary] });
    }
    if (view.planningReference.length) {
      sections.push({ title: "참조 기획 산출물", entries: [...view.planningReference] });
    }
    if (view.planningPrimary.length) {
      sections.push({ title: "기획 산출물", entries: [...view.planningPrimary] });
    }
    if (!sections.length) sections.push({ title: "구현 산출물", entries: [] });
    return { sections };
  }

  const sections: { title: string; entries: ProjectArtifactHubEntry[] }[] = [];
  if (view.implementationPrimary.length) {
    sections.push({ title: "구현 산출물", entries: [...view.implementationPrimary] });
  }
  if (view.planningReference.length) {
    sections.push({ title: "참조 기획 산출물", entries: [...view.planningReference] });
  }
  if (!sections.length) sections.push({ title: "구현 산출물", entries: [] });
  return { sections };
}
