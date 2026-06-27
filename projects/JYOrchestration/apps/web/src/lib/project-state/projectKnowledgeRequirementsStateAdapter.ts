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
