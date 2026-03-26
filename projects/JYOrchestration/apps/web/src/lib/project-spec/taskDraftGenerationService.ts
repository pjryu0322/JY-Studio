import { prisma } from "@/lib/prisma";
import { generateTaskDraftsWithOpenAI } from "@/lib/project-spec/generateTaskDraftsWithOpenAI";
import { synthesizeWorkflowDrafts } from "@/lib/project-spec/workflowDraftSynthesis";

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

    const createdRows: { id: string; title: string; description: string | null; priority: string }[] = [];
    for (let i = 0; i < ai.tasks.length; i++) {
      const t = ai.tasks[i];
      const first = i === 0;
      const row = await tx.taskDraft.create({
        data: {
          projectId,
          specVersionId,
          title: t.title,
          description: t.description || null,
          priority: t.priority,
          dependsOn: [],
          dependsOnIds: [],
          acceptanceCriteria: t.acceptanceCriteria.length ? t.acceptanceCriteria : undefined,
          positionX: 0,
          positionY: i * 140,
          stage: "Build",
          createdByType: "AI",
          status: "DRAFT",
          sourceModel: ai.model,
          promptTokens: first ? (ai.usage?.promptTokens ?? null) : null,
          completionTokens: first ? (ai.usage?.completionTokens ?? null) : null,
          totalTokens: first ? (ai.usage?.totalTokens ?? null) : null,
          createdByUserId: userId,
        },
        select: { id: true, title: true, description: true, priority: true },
      });
      createdRows.push(row);
    }

    // 사용자 이해 중심의 기본 실행 흐름을 강제 합성 (고립 노드 방지)
    const synthesized = synthesizeWorkflowDrafts(
      createdRows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        priority: r.priority,
        stage: "Build",
      }))
    );
    const byId = new Map(synthesized.map((x) => [x.id, x] as const));
    const allIds = createdRows.map((r) => r.id);

    for (const id of allIds) {
      const s = byId.get(id);
      await tx.taskDraft.update({
        where: { id },
        data: {
          dependsOnIds: s?.dependsOnIds ?? [],
          dependsOn: [], // 제목 기반 의존성은 혼란을 줄이기 위해 비워두고 id 기반만 유지
          positionX: s?.positionX ?? 0,
          positionY: s?.positionY ?? 0,
          stage: s?.stage ?? "Build",
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
