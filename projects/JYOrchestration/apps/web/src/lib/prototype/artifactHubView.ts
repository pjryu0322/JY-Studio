import {
  buildArtifactBoardItems,
  calculateArtifactBoardTabCounts,
  formatArtifactBoardTabCountLabel,
  summarizeArtifactBoardStatuses,
  type ArtifactBoardItem,
  type ArtifactBoardTabCountMap,
} from "@/lib/artifacts/buildArtifactBoardItems";
import {
  defaultArtifactHubStageFilter,
  type ArtifactHubStageFilter,
} from "@/lib/prototype/artifactHubStage";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ArtifactHubWorkspaceMode = "planning" | "implementation";

export type ArtifactHubView = Readonly<{
  readonly mode: ArtifactHubWorkspaceMode;
  readonly defaultStageFilter: ArtifactHubStageFilter;
  readonly showStageFilters: boolean;
  /** @deprecated — boardItems 기준으로 대체 */
  readonly entries: readonly ProjectArtifactHubEntry[];
  readonly boardItems: readonly ArtifactBoardItem[];
  readonly tabCounts: ArtifactBoardTabCountMap;
  readonly statusSummary: string;
  readonly badgeCount: number;
  /** @deprecated */
  readonly implementationPrimary: readonly ProjectArtifactHubEntry[];
  /** @deprecated */
  readonly planningPrimary: readonly ProjectArtifactHubEntry[];
  /** @deprecated */
  readonly planningReference: readonly ProjectArtifactHubEntry[];
  readonly derivedTypes: readonly string[];
}>;

function filterBoardItemsByStage(
  items: readonly ArtifactBoardItem[],
  filter: ArtifactHubStageFilter,
): readonly ArtifactBoardItem[] {
  if (filter === "all") return items;
  if (filter === "review") return items.filter((i) => i.stage === "review");
  return items.filter((i) => i.stage === filter);
}

export function groupArtifactBoardItemsForDisplay(
  view: ArtifactHubView,
  filter: ArtifactHubStageFilter,
): Readonly<{
  readonly sections: readonly Readonly<{
    readonly title: string;
    readonly items: readonly ArtifactBoardItem[];
  }>[];
}> {
  const filtered = filterBoardItemsByStage(view.boardItems, filter);
  const required = filtered.filter((i) => i.requirementLevel === "required");
  const recommended = filtered.filter((i) => i.requirementLevel === "recommended");
  const optional = filtered.filter((i) => i.requirementLevel === "optional");

  const sections: { title: string; items: ArtifactBoardItem[] }[] = [];
  if (required.length) sections.push({ title: "필수 산출물", items: [...required] });
  if (recommended.length) sections.push({ title: "추천 산출물", items: [...recommended] });
  if (optional.length) sections.push({ title: "선택 산출물", items: [...optional] });
  if (!sections.length) {
    sections.push({ title: "작성 대상 산출물", items: [] });
  }
  return { sections };
}

/** @deprecated — groupArtifactBoardItemsForDisplay 사용 */
export function groupArtifactHubEntriesForDisplay(
  view: ArtifactHubView,
  filter: ArtifactHubStageFilter,
): Readonly<{
  readonly sections: readonly Readonly<{
    readonly title: string;
    readonly entries: readonly ProjectArtifactHubEntry[];
  }>[];
}> {
  const boardSections = groupArtifactBoardItemsForDisplay(view, filter).sections;
  return {
    sections: boardSections.map((s) => ({
      title: s.title,
      entries: s.items
        .filter((i) => i.hubEntry)
        .map((i) => i.hubEntry!),
    })),
  };
}

export function buildArtifactHubView(input: {
  readonly mode: ArtifactHubWorkspaceMode;
  readonly state: RequirementsStateJson;
  readonly projectId: string;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
}): ArtifactHubView {
  const projectId = input.projectId.trim();
  const projectArtifacts = input.projectArtifacts ?? input.state.projectArtifacts ?? [];
  const deliverableAssets = input.deliverableAssets ?? input.state.deliverableAssets ?? [];

  const stageFilterForCatalog: "all" | "planning" | "implementation" | "review" =
    input.mode === "planning" ? "planning" : "all";

  const boardItems = buildArtifactBoardItems({
    projectId,
    projectArtifacts,
    requirementsStateJson: input.state,
    deliverableAssets,
    selectedStage: stageFilterForCatalog,
  });

  const tabCounts = calculateArtifactBoardTabCounts(boardItems);
  const entries = boardItems
    .filter((i) => i.hubEntry)
    .map((i) => i.hubEntry!);

  const implementationItems = boardItems.filter((i) => i.stage === "implementation");
  const planningItems = boardItems.filter((i) => i.stage === "planning");

  return {
    mode: input.mode,
    defaultStageFilter: defaultArtifactHubStageFilter(input.mode),
    showStageFilters: true,
    entries,
    boardItems,
    tabCounts,
    statusSummary: summarizeArtifactBoardStatuses(boardItems),
    badgeCount: tabCounts.all.created,
    implementationPrimary: implementationItems
      .filter((i) => i.hubEntry)
      .map((i) => i.hubEntry!),
    planningPrimary: planningItems.filter((i) => i.hubEntry).map((i) => i.hubEntry!),
    planningReference: [],
    derivedTypes: implementationItems.map((i) => i.type),
  };
}

export { formatArtifactBoardTabCountLabel };
