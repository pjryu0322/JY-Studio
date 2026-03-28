import { prisma } from "@/lib/prisma";
import { generateTaskDraftsWithOpenAI } from "@/lib/project-spec/generateTaskDraftsWithOpenAI";
import { computeStageAwareLaneLayout, normalizeWorkflowStage } from "@/lib/project-spec/workflowLaneLayout";
import { stageForNodeType, withNodeTypePrefix, stripNodeTypePrefix } from "@/lib/project-spec/taskDraftHierarchy";
import type { TaskNodeType } from "@/lib/project-spec/taskDraftHierarchy";

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

type CreatedRowMeta = {
  id: string;
  type: TaskNodeType;
  title: string;
  description: string | null;
  priority: string;
  createdAt: Date;
  parentTitle: string | null;
};

function uniqueIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const v = String(id ?? "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

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

  const hierarchyItems = ai.tasks.filter((t) => t.type !== "task");
  const taskItems = ai.tasks.filter((t) => t.type === "task");

  const result = await prisma.$transaction(async (tx) => {
    const sup = await tx.taskDraft.updateMany({
      where: { projectId, status: "DRAFT" },
      data: { status: "SUPERSEDED" },
    });

    const createdRows: CreatedRowMeta[] = [];
    const depsById = new Map<string, string[]>();
    let hierarchyIndex = 0;

    for (const t of hierarchyItems) {
      const firstOverall = hierarchyIndex === 0;
      hierarchyIndex += 1;
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
          positionY: createdRows.length * 140,
          stage: stageForNodeType(t.type),
          createdByType: "AI",
          status: "DRAFT",
          sourceModel: ai.model,
          promptTokens: firstOverall ? (ai.usage?.promptTokens ?? null) : null,
          completionTokens: firstOverall ? (ai.usage?.completionTokens ?? null) : null,
          totalTokens: firstOverall ? (ai.usage?.totalTokens ?? null) : null,
          createdByUserId: userId,
        },
        select: { id: true, title: true, description: true, priority: true, createdAt: true },
      });
      createdRows.push({
        id: row.id,
        type: t.type,
        title: row.title,
        description: row.description,
        priority: row.priority,
        createdAt: row.createdAt,
        parentTitle: t.parentTitle,
      });
      depsById.set(row.id, []);
    }

    const localIdByFeature = new Map<string, Map<string, string>>();

    for (const t of taskItems) {
      const featTitle = t.parentTitle?.trim() ?? "";
      if (!featTitle) continue;

      const parentFeature = createdRows.find(
        (p) => p.type === "feature" && stripNodeTypePrefix(p.title) === featTitle
      );
      if (!parentFeature) continue;

      if (!localIdByFeature.has(featTitle)) {
        localIdByFeature.set(featTitle, new Map());
      }
      const lm = localIdByFeature.get(featTitle)!;

      const fromLocals: string[] = [];
      for (const lid of t.dependsOnLocalIds ?? []) {
        const resolved = lm.get(String(lid).trim());
        if (resolved) fromLocals.push(resolved);
      }

      const depIds = uniqueIds([parentFeature.id, ...fromLocals]);
      const row = await tx.taskDraft.create({
        data: {
          projectId,
          specVersionId,
          title: withNodeTypePrefix("task", t.title),
          description: t.description || null,
          priority: String(t.priority ?? "P1").toUpperCase().trim(),
          dependsOn: [],
          dependsOnIds: depIds,
          acceptanceCriteria: t.acceptanceCriteria.length ? t.acceptanceCriteria : undefined,
          taskInput: t.taskInput ?? null,
          taskOutput: t.taskOutput ?? null,
          estimatedSize: t.estimatedSize ?? null,
          executionKind: t.executionKind ?? null,
          positionX: 0,
          positionY: createdRows.length * 140,
          stage: stageForNodeType("task"),
          createdByType: "AI",
          status: "DRAFT",
          sourceModel: ai.model,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          createdByUserId: userId,
        },
        select: { id: true, title: true, description: true, priority: true, createdAt: true },
      });
      depsById.set(row.id, depIds);
      if (t.localTaskId) {
        lm.set(String(t.localTaskId).trim(), row.id);
      }
      createdRows.push({
        id: row.id,
        type: "task",
        title: row.title,
        description: row.description,
        priority: row.priority,
        createdAt: row.createdAt,
        parentTitle: featTitle,
      });
    }

    for (const r of createdRows) {
      if (r.type === "task") continue;
      const deps: string[] = [];
      if (r.parentTitle) {
        const parentType = r.type === "design" ? "requirement" : r.type === "feature" ? "design" : null;
        if (parentType) {
          const parentRow = createdRows.find(
            (p) => p.type === parentType && stripNodeTypePrefix(p.title) === r.parentTitle
          );
          if (parentRow && parentRow.id !== r.id) {
            deps.push(parentRow.id);
          }
        }
      }
      depsById.set(r.id, deps);
    }

    const edges: Array<{ source: string; target: string }> = [];
    for (const r of createdRows) {
      for (const dep of depsById.get(r.id) ?? []) {
        if (dep && dep !== r.id) {
          edges.push({ source: dep, target: r.id });
        }
      }
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
          dependsOnIds: depsById.get(row.id) ?? [],
          dependsOn: [],
          positionX: p?.x ?? 0,
          positionY: p?.y ?? 0,
          stage: stageForNodeType(row.type),
          createdByType: "AI",
        },
      });
    }

    return { supersededCount: sup.count, createdCount: createdRows.length };
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
