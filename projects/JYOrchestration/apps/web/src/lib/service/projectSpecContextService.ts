import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProjectSpecContextApi = {
  projectId: string;
  name: string;
  description: string | null;
  projectType: string;
  coreGoals: string | null;
  inScope: string | null;
  outOfScope: string | null;
  targetUsers: string | null;
  successCriteria: string | null;
  executionPlanMarkdown: string | null;
  selectedPlanCandidateId: string | null;
};

function mapRow(row: {
  id: string;
  name: string;
  description: string | null;
  projectType: string;
  specCoreGoals: string | null;
  specScopeIn: string | null;
  specScopeOut: string | null;
  specTargetUsers: string | null;
  specSuccessCriteria: string | null;
  executionPlanMarkdown: string | null;
  selectedPlanCandidateId: string | null;
}): ProjectSpecContextApi {
  return {
    projectId: row.id,
    name: row.name,
    description: row.description,
    projectType: row.projectType,
    coreGoals: row.specCoreGoals,
    inScope: row.specScopeIn,
    outOfScope: row.specScopeOut,
    targetUsers: row.specTargetUsers,
    successCriteria: row.specSuccessCriteria,
    executionPlanMarkdown: row.executionPlanMarkdown,
    selectedPlanCandidateId: row.selectedPlanCandidateId,
  };
}

export async function getProjectSpecContext(projectId: string): Promise<ProjectSpecContextApi | null> {
  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      projectType: true,
      specCoreGoals: true,
      specScopeIn: true,
      specScopeOut: true,
      specTargetUsers: true,
      specSuccessCriteria: true,
      executionPlanMarkdown: true,
      selectedPlanCandidateId: true,
    },
  });
  return row ? mapRow(row) : null;
}

export type ProjectSpecContextPatchInput = {
  name?: string;
  description?: string | null;
  projectType?: string;
  coreGoals?: string | null;
  inScope?: string | null;
  outOfScope?: string | null;
  targetUsers?: string | null;
  successCriteria?: string | null;
  executionPlanMarkdown?: string | null;
  selectedPlanCandidateId?: string | null;
};

export async function updateProjectSpecContext(
  projectId: string,
  patch: ProjectSpecContextPatchInput
): Promise<ProjectSpecContextApi | null> {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    data.name = patch.name;
  }
  if (patch.description !== undefined) {
    data.description = patch.description;
  }
  if (patch.projectType !== undefined) {
    data.projectType = patch.projectType;
  }
  if (patch.coreGoals !== undefined) {
    data.specCoreGoals = patch.coreGoals;
  }
  if (patch.inScope !== undefined) {
    data.specScopeIn = patch.inScope;
  }
  if (patch.outOfScope !== undefined) {
    data.specScopeOut = patch.outOfScope;
  }
  if (patch.targetUsers !== undefined) {
    data.specTargetUsers = patch.targetUsers;
  }
  if (patch.successCriteria !== undefined) {
    data.specSuccessCriteria = patch.successCriteria;
  }
  if (patch.executionPlanMarkdown !== undefined) {
    data.executionPlanMarkdown = patch.executionPlanMarkdown === null ? null : String(patch.executionPlanMarkdown);
  }
  if (patch.selectedPlanCandidateId !== undefined) {
    data.selectedPlanCandidateId =
      patch.selectedPlanCandidateId === null || patch.selectedPlanCandidateId === ""
        ? null
        : String(patch.selectedPlanCandidateId);
  }

  if (Object.keys(data).length === 0) {
    return getProjectSpecContext(projectId);
  }

  try {
    const row = await prisma.project.update({
      where: { id: projectId },
      data: data as Parameters<typeof prisma.project.update>[0]["data"],
      select: {
        id: true,
        name: true,
        description: true,
        projectType: true,
        specCoreGoals: true,
        specScopeIn: true,
        specScopeOut: true,
        specTargetUsers: true,
        specSuccessCriteria: true,
        executionPlanMarkdown: true,
        selectedPlanCandidateId: true,
      },
    });
    return mapRow(row);
  } catch (error) {
    // P2025: target row does not exist.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}
