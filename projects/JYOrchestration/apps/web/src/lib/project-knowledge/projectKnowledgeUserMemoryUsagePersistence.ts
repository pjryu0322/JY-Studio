import { prisma } from "@/lib/prisma";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import {
  appendUserProjectKnowledgeMemoryUsageEvents,
  normalizeUserProjectKnowledgeMemoryUsageStateV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsage";
import type {
  UserProjectKnowledgeMemoryUsageEventV1,
  UserProjectKnowledgeMemoryUsageStateV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsageTypes";
import type { Prisma } from "@prisma/client";

export function readUserProjectKnowledgeMemoryUsageStateFromRequirementsState(
  state: RequirementsStateJson | null | undefined,
): UserProjectKnowledgeMemoryUsageStateV1 {
  return normalizeUserProjectKnowledgeMemoryUsageStateV1(state?.userProjectKnowledgeMemoryUsageStateV1);
}

export async function appendUserProjectKnowledgeMemoryUsageEventForProject(input: {
  readonly projectId: string;
  readonly event: UserProjectKnowledgeMemoryUsageEventV1;
}): Promise<UserProjectKnowledgeMemoryUsageStateV1> {
  return appendUserProjectKnowledgeMemoryUsageEventsForProject({
    projectId: input.projectId,
    events: [input.event],
  });
}

export async function appendUserProjectKnowledgeMemoryUsageEventsForProject(input: {
  readonly projectId: string;
  readonly events: readonly UserProjectKnowledgeMemoryUsageEventV1[];
}): Promise<UserProjectKnowledgeMemoryUsageStateV1> {
  const pid = input.projectId.trim();
  if (!pid || !input.events.length) {
    return readUserProjectKnowledgeMemoryUsageStateFromRequirementsState({});
  }

  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  const current = readUserProjectKnowledgeMemoryUsageStateFromRequirementsState(state);
  const nextUsage = appendUserProjectKnowledgeMemoryUsageEvents({
    current,
    events: input.events,
  });
  const next = mergeRequirementsStateJson(state, {
    userProjectKnowledgeMemoryUsageStateV1: nextUsage,
  });
  await prisma.project.update({
    where: { id: pid },
    data: { requirementsStateJson: next as Prisma.InputJsonValue },
  });
  return nextUsage;
}

export async function loadUserProjectKnowledgeMemoryUsageStateForProject(
  projectId: string,
): Promise<UserProjectKnowledgeMemoryUsageStateV1> {
  const pid = projectId.trim();
  if (!pid) {
    return readUserProjectKnowledgeMemoryUsageStateFromRequirementsState({});
  }
  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  return readUserProjectKnowledgeMemoryUsageStateFromRequirementsState(state);
}
