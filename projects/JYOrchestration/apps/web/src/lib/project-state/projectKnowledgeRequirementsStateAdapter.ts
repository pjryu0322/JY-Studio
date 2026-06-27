import {
  appendUserProjectKnowledgeMemoryUsageEvents,
  normalizeUserProjectKnowledgeMemoryUsageStateV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsage";
import type {
  UserProjectKnowledgeMemoryUsageEventV1,
  UserProjectKnowledgeMemoryUsageStateV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsageTypes";
import { normalizeUserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import {
  mergeRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import {
  parseProjectReferenceSelectionSummaryV1,
  parseProjectReferenceSelectionV1,
  type ProjectReferenceSelectionSummaryV1,
  type ProjectReferenceSelectionV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import {
  parseMaterializedReferenceContextV1,
  type MaterializedReferenceContextV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import {
  parsePlanningKnowledgeGraphTraceV1,
  type PlanningKnowledgeGraphTraceV1,
} from "@/lib/project-graph/planningKnowledgeGraphTraceV1";

export function getUserMemoryControlFromRequirementsState(
  state: RequirementsStateJson | null | undefined,
): UserProjectKnowledgeMemoryControlV1 {
  return normalizeUserProjectKnowledgeMemoryControlV1(state?.userProjectKnowledgeMemoryControlV1);
}

export function setUserMemoryControlInRequirementsState(
  state: RequirementsStateJson | null | undefined,
  control: UserProjectKnowledgeMemoryControlV1,
): RequirementsStateJson {
  const base = state ?? {};
  return mergeRequirementsStateJson(base, { userProjectKnowledgeMemoryControlV1: control });
}

export function getUserMemoryUsageStateFromRequirementsState(
  state: RequirementsStateJson | null | undefined,
): UserProjectKnowledgeMemoryUsageStateV1 {
  return normalizeUserProjectKnowledgeMemoryUsageStateV1(state?.userProjectKnowledgeMemoryUsageStateV1);
}

export function appendUserMemoryUsageEventsToRequirementsState(
  state: RequirementsStateJson | null | undefined,
  events: readonly UserProjectKnowledgeMemoryUsageEventV1[],
): RequirementsStateJson {
  const base = state ?? {};
  const current = getUserMemoryUsageStateFromRequirementsState(base);
  const nextUsage = appendUserProjectKnowledgeMemoryUsageEvents({ current, events });
  return mergeRequirementsStateJson(base, { userProjectKnowledgeMemoryUsageStateV1: nextUsage });
}

export function getReferenceSelectionFromRequirementsState(
  state: RequirementsStateJson | null | undefined,
): ProjectReferenceSelectionV1 | null {
  if (state?.referenceSelectionV1 === null) return null;
  return parseProjectReferenceSelectionV1(state?.referenceSelectionV1);
}

export function setReferenceSelectionInRequirementsState(
  state: RequirementsStateJson | null | undefined,
  selection: ProjectReferenceSelectionV1 | null,
): RequirementsStateJson {
  return mergeRequirementsStateJson(state ?? {}, { referenceSelectionV1: selection });
}

export function getReferenceSelectionSummaryFromRequirementsState(
  state: RequirementsStateJson | null | undefined,
): ProjectReferenceSelectionSummaryV1 | null {
  if (state?.referenceSelectionSummaryV1 === null) return null;
  return parseProjectReferenceSelectionSummaryV1(state?.referenceSelectionSummaryV1);
}

export function setReferenceSelectionSummaryInRequirementsState(
  state: RequirementsStateJson | null | undefined,
  summary: ProjectReferenceSelectionSummaryV1 | null,
): RequirementsStateJson {
  return mergeRequirementsStateJson(state ?? {}, { referenceSelectionSummaryV1: summary });
}

export function getMaterializedReferenceContextFromRequirementsState(
  state: RequirementsStateJson | null | undefined,
): MaterializedReferenceContextV1 | null {
  if (state?.materializedReferenceContextV1 === null) return null;
  return parseMaterializedReferenceContextV1(state?.materializedReferenceContextV1);
}

export function setMaterializedReferenceContextInRequirementsState(
  state: RequirementsStateJson | null | undefined,
  context: MaterializedReferenceContextV1 | null,
): RequirementsStateJson {
  return mergeRequirementsStateJson(state ?? {}, { materializedReferenceContextV1: context });
}

export function getPlanningKnowledgeGraphTraceFromRequirementsState(
  state: RequirementsStateJson | null | undefined,
): PlanningKnowledgeGraphTraceV1 | null {
  if (state?.planningKnowledgeGraphTraceV1 === null) return null;
  return parsePlanningKnowledgeGraphTraceV1(state?.planningKnowledgeGraphTraceV1);
}

export function setPlanningKnowledgeGraphTraceInRequirementsState(
  state: RequirementsStateJson | null | undefined,
  trace: PlanningKnowledgeGraphTraceV1 | null,
): RequirementsStateJson {
  return mergeRequirementsStateJson(state ?? {}, { planningKnowledgeGraphTraceV1: trace });
}
