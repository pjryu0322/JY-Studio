import { prisma } from "@/lib/prisma";
import { generateTaskDraftsWithOpenAI } from "@/lib/project-spec/generateTaskDraftsWithOpenAI";
import { computeStageAwareLaneLayout, normalizeWorkflowStage } from "@/lib/project-spec/workflowLaneLayout";
import { stageForNodeType, withNodeTypePrefix, stripNodeTypePrefix } from "@/lib/project-spec/taskDraftHierarchy";

export type TaskDraftSyncResult = {
  supersededCount: number;
  createdCount: number;
  model: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  } | null;
};

/**
 * OpenAI로 Task 초안을 생성하고, 기존 DRAFT는 SUPERSEDED로 바꾼 뒤 새 행을 저장한다.
 * OpenAI 실패 시 기존 DRAFT는 유지된다.
 */
export async function syncTaskDraftsForProjectSpecVersion(params: {
  projectId: string;
  specVersionId: string;
  userId: string;
  model?: string | null;
}): Promise<TaskDraftSyncResult> {
  const { projectId, specVersionId, userId, model } = params;

  const [versionRow, projectRow] = await Promise.all([
    prisma.projectSpecVersion.findFirst({
      where: { id: specVersionId, projectId },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        description: true,
        projectType: true,
        specCoreGoals: true,
        specScopeIn: true,
        specScopeOut: true,
        specTargetUsers: true,
        specSuccessCriteria: true,
        confirmedSpecMarkdown: true,
      },
    }),
  ]);

  if (!versionRow || !projectRow) {
    throw new Error("SPEC_VERSION_OR_PROJECT_NOT_FOUND");
  }

  const specMarkdown =
    versionRow.markdown?.trim() || projectRow.confirmedSpecMarkdown?.trim() || "";
  if (!specMarkdown) {
    throw new Error("SPEC_MARKDOWN_EMPTY");
  }

  const ai = await generateTaskDraftsWithOpenAI({
    projectName: projectRow.name,
    projectDescription: projectRow.description,
    projectType: projectRow.projectType,
    specCoreGoals: projectRow.specCoreGoals,
    specScopeIn: projectRow.specScopeIn,
    specScopeOut: projectRow.specScopeOut,
    specTargetUsers: projectRow.specTargetUsers,
    specSuccessCriteria: projectRow.specSuccessCriteria,
    specMarkdown,
    modelFromRequest: model,
  });

  const result = await prisma.$transaction(async (tx) => {
    const sup = await tx.taskDraft.updateMany({
      where: { projectId, status: "DRAFT" },
      data: { status: "SUPERSEDED" },
    });

    const createdRows: {
      id: string;
      type: "requirement" | "design" | "feature" | "task";
      title: string;
      description: string | null;
      priority: string;
      createdAt: Date;
      parentTitle: string | null;
    }[] = [];
    for (let i = 0; i < ai.tasks.length; i++) {
      const t = ai.tasks[i];
      const first = i === 0;
      const row = await tx.taskDraft.create({
        data: {
          projectId,
          specVersionId,
          title: withNodeTypePrefix(t.type, t.title),
          description: t.description || null,
          priority: t.priority,
          dependsOn: [],
          dependsOnIds: [],
          acceptanceCriteria: t.acceptanceCriteria.length ? t.acceptanceCriteria : undefined,
          positionX: 0,
          positionY: i * 140,
          stage: stageForNodeType(t.type),
          createdByType: "AI",
          status: "DRAFT",
          sourceModel: ai.model,
          promptTokens: first ? (ai.usage?.promptTokens ?? null) : null,
          completionTokens: first ? (ai.usage?.completionTokens ?? null) : null,
          totalTokens: first ? (ai.usage?.totalTokens ?? null) : null,
          createdByUserId: userId,
        },
        select: { id: true, title: true, description: true, priority: true, createdAt: true },
      });
      createdRows.push({
        ...row,
        type: t.type,
        parentTitle: t.parentTitle,
      });
    }

    // 계층 DAG: parent -> child (child dependsOn parent)
    const edges: Array<{ source: string; target: string }> = [];
    const dependsById = new Map<string, string[]>();
    for (const r of createdRows) {
      const deps: string[] = [];
      if (r.parentTitle) {
        const parentType =
          r.type === "design" ? "requirement" : r.type === "feature" ? "design" : r.type === "task" ? "feature" : null;
        if (parentType) {
          const parentRow = createdRows.find(
            (p) => p.type === parentType && stripNodeTypePrefix(p.title) === r.parentTitle
          );
          if (parentRow && parentRow.id !== r.id) {
            deps.push(parentRow.id);
            edges.push({ source: parentRow.id, target: r.id });
          }
        }
      }
      dependsById.set(r.id, deps);
    }

    const layout = computeStageAwareLaneLayout(
      createdRows.map((r) => ({ id: r.id, stage: normalizeWorkflowStage(stageForNodeType(r.type)) })),
      edges
    );
    const posById = new Map(layout.map((p) => [p.id, p] as const));

    for (const row of createdRows) {
      const p = posById.get(row.id);
      await tx.taskDraft.update({
        where: { id: row.id },
        data: {
          dependsOnIds: dependsById.get(row.id) ?? [],
          dependsOn: [],
          positionX: p?.x ?? 0,
          positionY: p?.y ?? 0,
          stage: stageForNodeType(row.type),
          createdByType: "AI",
        },
      });
    }

    return { supersededCount: sup.count, createdCount: ai.tasks.length };
  });

  return {
    supersededCount: result.supersededCount,
    createdCount: result.createdCount,
    model: ai.model,
    usage: ai.usage
      ? {
          promptTokens: ai.usage.promptTokens,
          completionTokens: ai.usage.completionTokens,
          totalTokens: ai.usage.totalTokens,
        }
      : null,
  };
}
