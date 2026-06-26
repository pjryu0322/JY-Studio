import { prisma } from "@/lib/prisma";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import {
  normalizeUserProjectKnowledgeMemoryControlV1,
  patchUserProjectKnowledgeMemoryControlV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { Prisma } from "@prisma/client";

export function readUserProjectKnowledgeMemoryControlFromState(
  state: RequirementsStateJson | null | undefined,
): UserProjectKnowledgeMemoryControlV1 {
  return normalizeUserProjectKnowledgeMemoryControlV1(state?.userProjectKnowledgeMemoryControlV1);
}

export async function loadUserProjectKnowledgeMemoryControlForProject(
  projectId: string,
): Promise<UserProjectKnowledgeMemoryControlV1> {
  const pid = projectId.trim();
  if (!pid) return normalizeUserProjectKnowledgeMemoryControlV1(undefined);
  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  return readUserProjectKnowledgeMemoryControlFromState(state);
}

export async function saveUserProjectKnowledgeMemoryControlForProject(input: {
  readonly projectId: string;
  readonly control: UserProjectKnowledgeMemoryControlV1;
}): Promise<UserProjectKnowledgeMemoryControlV1> {
  const pid = input.projectId.trim();
  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  const next = mergeRequirementsStateJson(state, {
    userProjectKnowledgeMemoryControlV1: input.control,
  });
  await prisma.project.update({
    where: { id: pid },
    data: { requirementsStateJson: next as Prisma.InputJsonValue },
  });
  return input.control;
}

export async function patchUserProjectKnowledgeMemoryControlForProject(input: {
  readonly projectId: string;
  readonly patch: Partial<UserProjectKnowledgeMemoryControlV1>;
  readonly nowIso?: string;
}): Promise<UserProjectKnowledgeMemoryControlV1> {
  const current = await loadUserProjectKnowledgeMemoryControlForProject(input.projectId);
  const next = patchUserProjectKnowledgeMemoryControlV1(current, input.patch, input.nowIso);
  return saveUserProjectKnowledgeMemoryControlForProject({
    projectId: input.projectId,
    control: next,
  });
}
