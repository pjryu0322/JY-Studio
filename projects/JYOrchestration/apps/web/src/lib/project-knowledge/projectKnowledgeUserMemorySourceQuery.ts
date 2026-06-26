import { prisma } from "@/lib/prisma";
import { PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";
import { getProjectGraphSnapshot } from "@/lib/project-graph/projectGraphQuery";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import {
  PROJECT_KNOWLEDGE_AGENTS,
  isAgentPromptRelevant,
  resolveAgentRelevanceFromNode,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import type { UserProjectKnowledgeMemorySourceProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

export const DEFAULT_USER_MEMORY_SOURCE_PROJECT_LIMIT = 10;

export function mapGraphDbNodeToProjectGraphNodeDto(node: {
  readonly id: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string | null | undefined;
  readonly metadata: unknown;
}): ProjectGraphNodeDto {
  const agentRelevance = resolveAgentRelevanceFromNode({ metadata: node.metadata });
  return {
    id: node.id,
    nodeType: node.nodeType,
    title: node.title,
    summary: node.summary == null || node.summary === "" ? null : String(node.summary),
    ...(Object.keys(agentRelevance).length > 0 ? { agentRelevance } : {}),
  };
}

export function projectGraphHasPromptRelevantAgentKnowledge(nodes: readonly ProjectGraphNodeDto[]): boolean {
  for (const node of nodes) {
    for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
      if (isAgentPromptRelevant(node, agent)) return true;
    }
  }
  return false;
}

export function mapOwnedProjectRowsToMemorySources(input: {
  readonly userId: string;
  readonly targetProjectId?: string;
  readonly projects: readonly {
    readonly id: string;
    readonly name: string;
    readonly ownerUserId: string;
    readonly updatedAt: Date;
  }[];
  readonly nodesByProjectId: Readonly<Record<string, readonly ProjectGraphNodeDto[]>>;
}): UserProjectKnowledgeMemorySourceProject[] {
  const out: UserProjectKnowledgeMemorySourceProject[] = [];
  for (const project of input.projects) {
    if (project.ownerUserId !== input.userId) continue;
    if (input.targetProjectId && project.id === input.targetProjectId) continue;
    const nodes = input.nodesByProjectId[project.id] ?? [];
    if (!projectGraphHasPromptRelevantAgentKnowledge(nodes)) continue;
    out.push({
      projectId: project.id,
      projectTitle: project.name,
      ownerUserId: project.ownerUserId,
      nodes,
      updatedAt: project.updatedAt.toISOString(),
    });
  }
  return out;
}

export async function listSameUserProjectKnowledgeMemorySources(input: {
  readonly userId: string;
  readonly targetProjectId?: string;
  readonly limitProjects?: number;
}): Promise<readonly UserProjectKnowledgeMemorySourceProject[]> {
  const userId = String(input.userId ?? "").trim();
  if (!userId) return [];

  const limit = Math.min(50, Math.max(1, input.limitProjects ?? DEFAULT_USER_MEMORY_SOURCE_PROJECT_LIMIT));
  const targetProjectId = String(input.targetProjectId ?? "").trim() || undefined;

  const projects = await prisma.project.findMany({
    where: {
      ownerUserId: userId,
      status: { not: PROJECT_LIFECYCLE_DELETED },
      ...(targetProjectId ? { id: { not: targetProjectId } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      updatedAt: true,
    },
  });

  const nodesByProjectId: Record<string, ProjectGraphNodeDto[]> = {};
  for (const project of projects) {
    const snapshot = await getProjectGraphSnapshot(project.id, { limit: 500 });
    nodesByProjectId[project.id] = snapshot.nodes.map((n) =>
      mapGraphDbNodeToProjectGraphNodeDto({
        id: n.id,
        nodeType: n.nodeType,
        title: n.title,
        summary: n.summary,
        metadata: n.metadata,
      }),
    );
  }

  return mapOwnedProjectRowsToMemorySources({
    userId,
    targetProjectId,
    projects,
    nodesByProjectId,
  });
}
