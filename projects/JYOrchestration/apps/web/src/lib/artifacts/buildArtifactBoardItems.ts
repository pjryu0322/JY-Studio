import {
  allArtifactBoardCatalogItems,
  artifactBoardCatalogForStageFilter,
  PLANNING_RECOMMENDED_ARTIFACT_CATALOG,
  PLANNING_REQUIRED_ARTIFACT_CATALOG,
  type ArtifactBoardCatalogItem,
  type ArtifactStage,
} from "@/lib/artifacts/artifactBoardCatalog";
import {
  ARTIFACT_BOARD_STATUS_LABELS,
  isArtifactBoardStatusAvailable,
  isArtifactBoardStatusCompleted,
  isArtifactContentMeaningful,
  type ArtifactBoardStatus,
} from "@/lib/artifacts/artifactBoardStatus";
import {
  buildDerivedImplementationArtifacts,
  derivedImplementationArtifactToHubEntry,
  type DerivedImplementationArtifact,
} from "@/lib/prototype/implementationArtifacts";
import { collectReferencePlanningArtifacts } from "@/lib/prototype/implementationWorkPlanDraft";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import { buildProjectArtifactHubCatalog } from "@/lib/requirements/projectArtifactHub";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ArtifactBoardAction =
  | "open"
  | "generate_planning_artifact"
  | "generate_implementation_seed"
  | "generate_implementation_work_plan"
  | "generate_code_agent_instruction"
  | "go_to_implementation"
  | "review_db_integration"
  | "regenerate"
  | "download_doc"
  | "download_pdf"
  | "revise";

export type ArtifactBoardItem = Readonly<{
  readonly catalogId: string;
  readonly type: string;
  readonly title: string;
  readonly stage: ArtifactStage;
  readonly requirementLevel: ArtifactBoardCatalogItem["requirementLevel"];
  readonly status: ArtifactBoardStatus;
  readonly statusLabel: string;
  readonly description: string;
  readonly createdArtifactId?: string;
  readonly latestVersion?: string;
  readonly updatedAt?: string;
  readonly missingReason?: string;
  readonly generationCondition?: string;
  readonly actions: readonly ArtifactBoardAction[];
  readonly hubEntry?: ProjectArtifactHubEntry;
  readonly derivedMarkdown?: string;
}>;

export type ArtifactBoardTabCounts = Readonly<{
  readonly created: number;
  readonly total: number;
}>;

export type ArtifactBoardTabCountMap = Readonly<{
  readonly all: ArtifactBoardTabCounts;
  readonly planning: ArtifactBoardTabCounts;
  readonly implementation: ArtifactBoardTabCounts;
  readonly review: ArtifactBoardTabCounts;
}>;

export type BuildArtifactBoardItemsInput = Readonly<{
  readonly projectId: string;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly requirementsStateJson: RequirementsStateJson;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[] | null;
  readonly selectedStage?: "all" | "planning" | "implementation" | "review";
}>;

function boardActionsForGeneratable(
  catalog: ArtifactBoardCatalogItem,
): readonly ArtifactBoardAction[] {
  if (catalog.stage === "planning") return ["generate_planning_artifact"];
  switch (catalog.id) {
    case "impl-seed":
      return ["go_to_implementation"];
    case "impl-work-plan":
      return ["generate_implementation_work_plan"];
    case "impl-code-agent":
      return ["generate_code_agent_instruction"];
    case "impl-db-decision":
      return ["review_db_integration"];
    default:
      return ["go_to_implementation"];
  }
}

function boardActionsForStatus(
  status: ArtifactBoardStatus,
  catalog: ArtifactBoardCatalogItem,
): readonly ArtifactBoardAction[] {
  switch (status) {
    case "created":
      return ["open", "download_doc", "download_pdf", "regenerate"];
    case "missing":
    case "generatable":
      return boardActionsForGeneratable(catalog);
    case "needs_revision":
      return ["open", "revise", "regenerate"];
    case "candidate":
      return ["open", "revise"];
    case "stale":
      return ["open", "regenerate"];
    case "waiting":
    default:
      return [];
  }
}

function isOlderThan(
  valueUpdatedAt: string | undefined,
  referenceUpdatedAt: string | undefined,
): boolean {
  const a = String(valueUpdatedAt ?? "").trim();
  const b = String(referenceUpdatedAt ?? "").trim();
  if (!a || !b) return false;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return ta < tb;
}

function maxIsoTimestamp(...values: readonly (string | undefined)[]): string | undefined {
  let best: string | undefined;
  let bestMs = -Infinity;
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    const ms = Date.parse(s);
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = s;
    }
  }
  return best;
}

function latestPlanningArtifactUpdatedAt(
  projectArtifacts: readonly ProjectArtifact[],
): string | undefined {
  const types = new Set(
    PLANNING_REQUIRED_ARTIFACT_CATALOG.map((c) => c.matchType).concat(
      PLANNING_RECOMMENDED_ARTIFACT_CATALOG.map((c) => c.matchType),
    ),
  );
  let latest: string | undefined;
  for (const art of projectArtifacts) {
    if (!types.has(art.type)) continue;
    if (!isArtifactContentMeaningful(art.content)) continue;
    latest = maxIsoTimestamp(latest, art.createdAt);
  }
  return latest;
}

function latestCodeAgentWorkItemsReferenceAt(
  state: RequirementsStateJson,
  planUpdatedAt: string | undefined,
): string | undefined {
  const wip = state.codeAgentWipExecutionV1;
  const lastCommit = wip?.commits[wip.commits.length - 1]?.createdAt;
  return maxIsoTimestamp(planUpdatedAt, lastCommit, wip?.requestedAt);
}

function resolveImplementationStaleReason(input: {
  readonly catalog: ArtifactBoardCatalogItem;
  readonly state: RequirementsStateJson;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly derivedUpdatedAt?: string;
}): string | undefined {
  const { catalog, state, projectArtifacts, derivedUpdatedAt } = input;
  const seed = state.implementationSeedV1;
  const draft = state.implementationWorkPlanDraftV1;
  const plan = state.implementationTaskPlanV1;
  const latestPlanningAt = latestPlanningArtifactUpdatedAt(projectArtifacts);

  switch (catalog.id) {
    case "impl-seed":
      if (
        seed &&
        latestPlanningAt &&
        isOlderThan(seed.updatedAt, latestPlanningAt)
      ) {
        return "기획 산출물이 갱신되어 구현 준비정보가 최신이 아닙니다.";
      }
      return undefined;
    case "impl-readiness":
      if (
        seed &&
        latestPlanningAt &&
        isOlderThan(seed.updatedAt, latestPlanningAt)
      ) {
        return "구현 준비정보가 기획 산출물보다 이전입니다.";
      }
      return undefined;
    case "impl-work-plan": {
      const draftAt = draft?.updatedAt ?? derivedUpdatedAt;
      if (seed && isOlderThan(draftAt, seed.updatedAt)) {
        return "구현 준비정보보다 이전에 작성된 구현 작업안입니다.";
      }
      if (latestPlanningAt && isOlderThan(draftAt, latestPlanningAt)) {
        return "기획 산출물이 갱신되어 구현 작업안이 최신이 아닙니다.";
      }
      return undefined;
    }
    case "impl-code-agent": {
      const workRef = latestCodeAgentWorkItemsReferenceAt(state, plan?.createdAt);
      if (draft?.updatedAt && workRef && isOlderThan(workRef, draft.updatedAt)) {
        return "구현 작업안이 갱신되어 작업 지시서가 최신이 아닙니다.";
      }
      return undefined;
    }
    case "impl-wip-report": {
      const wip = state.codeAgentWipExecutionV1;
      const wipAt = wip?.commits[wip.commits.length - 1]?.createdAt ?? wip?.requestedAt;
      const workRef = latestCodeAgentWorkItemsReferenceAt(state, plan?.createdAt);
      if (workRef && wipAt && isOlderThan(wipAt, workRef)) {
        return "작업 지시 이후 WIP 결과가 갱신되지 않았습니다.";
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

function applyImplementationStaleIfNeeded(
  base: Pick<ArtifactBoardItem, "status" | "generationCondition" | "missingReason">,
  catalog: ArtifactBoardCatalogItem,
  context: {
    readonly state: RequirementsStateJson;
    readonly projectArtifacts: readonly ProjectArtifact[];
    readonly derivedUpdatedAt?: string;
  },
): Pick<ArtifactBoardItem, "status" | "generationCondition" | "missingReason"> {
  if (
    base.status !== "created" &&
    base.status !== "needs_revision" &&
    base.status !== "candidate"
  ) {
    return base;
  }
  const staleReason = resolveImplementationStaleReason({
    catalog,
    state: context.state,
    projectArtifacts: context.projectArtifacts,
    derivedUpdatedAt: context.derivedUpdatedAt,
  });
  if (!staleReason) return base;
  return { status: "stale", generationCondition: staleReason };
}

function findPlanningArtifact(
  artifacts: readonly ProjectArtifact[],
  matchType: string,
): ProjectArtifact | null {
  const matches = artifacts.filter((a) => a.type === matchType);
  for (const art of matches) {
    if (isArtifactContentMeaningful(art.content)) return art;
  }
  return matches[0] ?? null;
}

function findDerived(
  derived: readonly DerivedImplementationArtifact[],
  matchType: string,
): DerivedImplementationArtifact | null {
  return derived.find((d) => d.type === matchType) ?? null;
}

function catalogDepsSatisfied(
  catalog: ArtifactBoardCatalogItem,
  createdCatalogIds: ReadonlySet<string>,
): boolean {
  if (!catalog.dependsOn?.length) return true;
  return catalog.dependsOn.every((id) => createdCatalogIds.has(id));
}

function resolvePlanningBoardStatus(input: {
  readonly catalog: ArtifactBoardCatalogItem;
  readonly artifact: ProjectArtifact | null;
  readonly createdCatalogIds: ReadonlySet<string>;
}): Pick<ArtifactBoardItem, "status" | "generationCondition" | "missingReason"> {
  const depsOk = catalogDepsSatisfied(input.catalog, input.createdCatalogIds);
  const art = input.artifact;
  if (art && isArtifactContentMeaningful(art.content)) {
    const score = art.orchestration?.completenessScore;
    if (typeof score === "number" && score < 0.45) {
      return {
        status: "needs_revision",
        generationCondition: "내용 보완 후 재생성이 필요합니다.",
      };
    }
    if (art.orchestration?.hubReadinessLabel?.includes("보완")) {
      return {
        status: "needs_revision",
        generationCondition: art.orchestration.hubReadinessLabel,
      };
    }
    return { status: "created" };
  }
  if (!depsOk) {
    return {
      status: "waiting",
      generationCondition: "선행 산출물 생성이 필요합니다.",
    };
  }
  return {
    status: "generatable",
    generationCondition: "현재 프로젝트·슬롯 상태를 바탕으로 생성할 수 있습니다.",
  };
}

function resolveImplementationBoardStatus(input: {
  readonly catalog: ArtifactBoardCatalogItem;
  readonly derived: DerivedImplementationArtifact | null;
  readonly state: RequirementsStateJson;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly planningRefCount: number;
  readonly createdCatalogIds: ReadonlySet<string>;
}): Pick<ArtifactBoardItem, "status" | "generationCondition" | "missingReason"> {
  const { catalog, derived, state, projectArtifacts, planningRefCount, createdCatalogIds } = input;
  const seed = state.implementationSeedV1;
  const draft = state.implementationWorkPlanDraftV1;
  const plan = state.implementationTaskPlanV1;
  const workItems = state.cursorWorkItemsV1 ?? [];
  const depsOk = catalogDepsSatisfied(catalog, createdCatalogIds);

  if (derived && isArtifactContentMeaningful(derived.body)) {
    if (catalog.matchType === "implementation-seed") {
      if (seed?.lifecycleStatus === "candidate" || seed?.lifecycleStatus === "partial") {
        return applyImplementationStaleIfNeeded(
          { status: "candidate", generationCondition: "사용자 확정 전 후보 상태입니다." },
          catalog,
          { state, projectArtifacts, derivedUpdatedAt: derived.updatedAt },
        );
      }
    }
    if (catalog.matchType === "implementation-work-plan-draft" && draft?.status === "draft") {
      if (!draft.actorCapabilityMatrix?.length) {
        return applyImplementationStaleIfNeeded(
          {
            status: "needs_revision",
            generationCondition: "액터 권한 매트릭스 등 일부 항목 보완이 필요합니다.",
          },
          catalog,
          { state, projectArtifacts, derivedUpdatedAt: derived.updatedAt },
        );
      }
    }
    return applyImplementationStaleIfNeeded(
      { status: "created" },
      catalog,
      { state, projectArtifacts, derivedUpdatedAt: derived.updatedAt },
    );
  }

  switch (catalog.id) {
    case "impl-seed":
      if (planningRefCount === 0) {
        return {
          status: "waiting",
          generationCondition: "기획 산출물이 없어 구현 준비정보를 생성할 수 없습니다.",
        };
      }
      return {
        status: "generatable",
        generationCondition: `기획 산출물 ${planningRefCount}건을 기준으로 Seed를 생성할 수 있습니다.`,
      };
    case "impl-readiness":
      if (!seed) {
        return { status: "waiting", generationCondition: "구현 준비정보 생성이 필요합니다." };
      }
      return {
        status: seed.readiness.ready ? "generatable" : "candidate",
        generationCondition: "Seed 준비도 점검 후 생성됩니다.",
      };
    case "impl-work-plan": {
      if (planningRefCount === 0) {
        return {
          status: "waiting",
          generationCondition: "기획 산출물이 없어 구현 작업안을 생성할 수 없습니다.",
        };
      }
      if (!seed?.readiness.ready) {
        return {
          status: "waiting",
          generationCondition: "Implementation Seed 준비도를 충족한 뒤 생성할 수 있습니다.",
        };
      }
      if (plan?.items.length || draft) {
        return { status: "created" };
      }
      return {
        status: "generatable",
        generationCondition: `기획 산출물 ${planningRefCount}건과 구현 준비정보를 기준으로 생성합니다.`,
      };
    }
    case "impl-code-agent":
      if (draft?.status === "confirmed" || plan?.items.length) {
        if (workItems.length) return { status: "created" };
        return {
          status: "generatable",
          generationCondition: "구현 작업안 확정 후 AI개발자 작업 지시서를 생성할 수 있습니다.",
        };
      }
      return {
        status: "waiting",
        generationCondition: "구현 작업안 확정이 필요합니다.",
      };
    case "impl-wip-report":
      if ((state.codeAgentWipExecutionV1?.commits.length ?? 0) > 0) {
        return { status: "created" };
      }
      return {
        status: "waiting",
        generationCondition: "AI개발자 WIP 작업 실행 후 생성됩니다.",
      };
    default:
      break;
  }

  if (!depsOk) {
    return { status: "waiting", generationCondition: "선행 산출물이 필요합니다." };
  }
  if (planningRefCount === 0 && catalog.stage === "implementation") {
    return { status: "waiting", generationCondition: "기획 산출물 참조가 필요합니다." };
  }
  return { status: "missing", generationCondition: "아직 생성되지 않았습니다." };
}

function planningArtifactToHubEntry(art: ProjectArtifact): ProjectArtifactHubEntry {
  return {
    id: `artifact-${art.id}`,
    kind: "project-artifact",
    artifactType: art.type,
    title: art.title,
    sourceStage: art.sourceStage,
    createdAt: art.createdAt,
    assetId: art.id,
    artifactStage: "planning",
    hubSection: "planning-primary",
    ...(art.orchestration
      ? {
          hubReason: art.orchestration.reason,
          hubRequired: art.orchestration.required,
          hubCompletenessScore: art.orchestration.completenessScore,
          hubReadinessLabel: art.orchestration.hubReadinessLabel,
        }
      : {}),
  };
}

function derivedToHubEntry(d: DerivedImplementationArtifact): ProjectArtifactHubEntry {
  return derivedImplementationArtifactToHubEntry(d);
}

export function buildArtifactBoardItems(input: BuildArtifactBoardItemsInput): readonly ArtifactBoardItem[] {
  const state = input.requirementsStateJson;
  const projectArtifacts = input.projectArtifacts ?? state.projectArtifacts ?? [];
  const catalogFilter = input.selectedStage ?? "all";
  const catalog = artifactBoardCatalogForStageFilter(catalogFilter);

  const derived = buildDerivedImplementationArtifacts({
    projectId: input.projectId.trim(),
    implementationSeedV1: state.implementationSeedV1,
    implementationWorkPlanDraftV1: state.implementationWorkPlanDraftV1,
    implementationTaskPlanV1: state.implementationTaskPlanV1,
    implementationSlotsV1: state.implementationSlotsV1,
    implementationDbStrategyV1: state.implementationDbStrategyV1,
    projectArtifacts,
    cursorWorkItemsV1: state.cursorWorkItemsV1,
    codeAgentWipExecutionV1: state.codeAgentWipExecutionV1,
  });

  const planningRefCount = collectReferencePlanningArtifacts(projectArtifacts).length;
  const items: ArtifactBoardItem[] = [];
  const createdCatalogIds = new Set<string>();

  const passResolve = (catalogItem: ArtifactBoardCatalogItem) => {
    if (catalogItem.stage === "planning") {
      const art = findPlanningArtifact(projectArtifacts, catalogItem.matchType);
      const resolved = resolvePlanningBoardStatus({
        catalog: catalogItem,
        artifact: art,
        createdCatalogIds,
      });
      if (isArtifactBoardStatusAvailable(resolved.status) && art) {
        createdCatalogIds.add(catalogItem.id);
      }
      const hubEntry = art ? planningArtifactToHubEntry(art) : undefined;
      items.push({
        catalogId: catalogItem.id,
        type: catalogItem.type,
        title: catalogItem.title,
        stage: catalogItem.stage,
        requirementLevel: catalogItem.requirementLevel,
        status: resolved.status,
        statusLabel: ARTIFACT_BOARD_STATUS_LABELS[resolved.status],
        description: catalogItem.description,
        ...(art
          ? {
              createdArtifactId: art.id,
              updatedAt: art.createdAt,
            }
          : {}),
        ...(resolved.generationCondition ? { generationCondition: resolved.generationCondition } : {}),
        ...(resolved.missingReason ? { missingReason: resolved.missingReason } : {}),
        actions: boardActionsForStatus(resolved.status, catalogItem),
        ...(hubEntry ? { hubEntry } : {}),
      });
      return;
    }

    const d =
      catalogItem.id === "impl-work-plan"
        ? findDerived(derived, "implementation-work-plan-draft") ??
          findDerived(derived, "implementation-task-plan")
        : findDerived(derived, catalogItem.matchType);
    const resolved = resolveImplementationBoardStatus({
      catalog: catalogItem,
      derived: d,
      state,
      projectArtifacts,
      planningRefCount,
      createdCatalogIds,
    });
    if (isArtifactBoardStatusAvailable(resolved.status) && d) {
      createdCatalogIds.add(catalogItem.id);
    }
    const hubEntry = d ? derivedToHubEntry(d) : undefined;
    items.push({
      catalogId: catalogItem.id,
      type: catalogItem.type,
      title: catalogItem.title,
      stage: catalogItem.stage,
      requirementLevel: catalogItem.requirementLevel,
      status: resolved.status,
      statusLabel: ARTIFACT_BOARD_STATUS_LABELS[resolved.status],
      description: catalogItem.description,
      ...(d ? { createdArtifactId: d.id, updatedAt: d.updatedAt, derivedMarkdown: d.body } : {}),
      ...(resolved.generationCondition ? { generationCondition: resolved.generationCondition } : {}),
      actions: boardActionsForStatus(resolved.status, catalogItem),
      ...(hubEntry ? { hubEntry } : {}),
    });
  };

  for (const c of allArtifactBoardCatalogItems()) {
    if (!catalog.some((x) => x.id === c.id)) continue;
    passResolve(c);
  }

  return items;
}

export function calculateArtifactBoardTabCounts(
  items: readonly ArtifactBoardItem[],
): ArtifactBoardTabCountMap {
  const countFor = (filter: "all" | "planning" | "implementation" | "review"): ArtifactBoardTabCounts => {
    const subset =
      filter === "all"
        ? items
        : items.filter((i) => (filter === "review" ? i.stage === "review" : i.stage === filter));
    const total = subset.length;
    const created = subset.filter((i) => isArtifactBoardStatusCompleted(i.status)).length;
    return { created, total };
  };
  return {
    all: countFor("all"),
    planning: countFor("planning"),
    implementation: countFor("implementation"),
    review: countFor("review"),
  };
}

export function formatArtifactBoardTabCountLabel(counts: ArtifactBoardTabCounts): string {
  return `${counts.created}/${counts.total}`;
}

export function summarizeArtifactBoardStatuses(
  items: readonly ArtifactBoardItem[],
): string {
  const count = (status: ArtifactBoardStatus) =>
    items.filter((i) => i.status === status).length;
  const parts: string[] = [];
  const completed = count("created");
  if (completed) parts.push(`생성완료 ${completed}`);
  const needsRevision = count("needs_revision");
  if (needsRevision) parts.push(`보완필요 ${needsRevision}`);
  const candidate = count("candidate");
  if (candidate) parts.push(`후보 ${candidate}`);
  const generatable = count("generatable");
  if (generatable) parts.push(`생성가능 ${generatable}`);
  const waiting = count("waiting");
  if (waiting) parts.push(`생성대기 ${waiting}`);
  const missing = count("missing");
  if (missing) parts.push(`미생성 ${missing}`);
  const stale = count("stale");
  if (stale) parts.push(`최신아님 ${stale}`);
  return parts.length ? parts.join(" · ") : "생성완료 0";
}

/** board item 목록 → Hub drawer용 entries (생성완료·보완·후보만) */
export function artifactBoardItemsToHubEntries(
  items: readonly ArtifactBoardItem[],
): readonly ProjectArtifactHubEntry[] {
  return items
    .filter((i) => i.hubEntry && isArtifactBoardStatusAvailable(i.status))
    .map((i) => i.hubEntry!);
}

export function buildArtifactBoardHubCatalog(input: BuildArtifactBoardItemsInput): readonly ProjectArtifactHubEntry[] {
  const board = buildArtifactBoardItems({ ...input, selectedStage: "all" });
  const fromBoard = artifactBoardItemsToHubEntries(board);
  const legacy = buildProjectArtifactHubCatalog({
    state: input.requirementsStateJson,
    projectArtifacts: input.projectArtifacts,
    deliverableAssets: input.deliverableAssets ?? undefined,
  });
  const byId = new Map<string, ProjectArtifactHubEntry>();
  for (const e of [...fromBoard, ...legacy]) {
    byId.set(e.id, e);
  }
  return [...byId.values()];
}
