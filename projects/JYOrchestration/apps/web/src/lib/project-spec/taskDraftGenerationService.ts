import { prisma } from "@/lib/prisma";
import { generateTaskDraftsWithOpenAI } from "@/lib/project-spec/generateTaskDraftsWithOpenAI";

function clampDependsOnIds(ids: string[]): string[] {
  return ids.map((x) => String(x).trim()).filter(Boolean).slice(0, 50);
}

function computeInitialPositions(input: {
  ids: string[];
  dependsOnIdsById: Map<string, string[]>;
}): Map<string, { x: number; y: number }> {
  // 간단한 DAG 레이아웃: topological layer(깊이)별로 좌→우, 같은 레이어는 위→아래
  const { ids, dependsOnIdsById } = input;
  const depthMemo = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    if (visiting.has(id)) return 0; // 순환이 있으면 0으로 폴백
    visiting.add(id);
    const deps = dependsOnIdsById.get(id) ?? [];
    const d = deps.length ? 1 + Math.max(...deps.map(depthOf)) : 0;
    visiting.delete(id);
    depthMemo.set(id, d);
    return d;
  };

  const layers = new Map<number, string[]>();
  for (const id of ids) {
    const d = depthOf(id);
    const arr = layers.get(d) ?? [];
    arr.push(id);
    layers.set(d, arr);
  }

  const out = new Map<string, { x: number; y: number }>();
  const layerKeys = [...layers.keys()].sort((a, b) => a - b);
  const X_GAP = 340;
  const Y_GAP = 160;
  for (const d of layerKeys) {
    const arr = layers.get(d) ?? [];
    arr.forEach((id, idx) => {
      out.set(id, { x: d * X_GAP, y: idx * Y_GAP });
    });
  }
  return out;
}

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

    const createdRows: { id: string; title: string }[] = [];
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
          dependsOn: t.dependsOn.length ? t.dependsOn : undefined,
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
        select: { id: true, title: true },
      });
      createdRows.push(row);
    }

    // OpenAI 출력은 dependsOn을 title 문자열로 줌 → 같은 생성 배치 내 title→id 매핑으로 dependsOnIds 채움
    const idByTitle = new Map<string, string>();
    for (const r of createdRows) {
      idByTitle.set(r.title, r.id);
    }
    const dependsOnIdsById = new Map<string, string[]>();
    for (const t of ai.tasks) {
      const id = idByTitle.get(t.title);
      if (!id) continue;
      const depIds = clampDependsOnIds(
        (t.dependsOn ?? [])
          .map((title) => idByTitle.get(title))
          .filter((x): x is string => Boolean(x))
      );
      dependsOnIdsById.set(id, depIds);
    }
    const allIds = createdRows.map((r) => r.id);
    const pos = computeInitialPositions({ ids: allIds, dependsOnIdsById });

    for (const id of allIds) {
      await tx.taskDraft.update({
        where: { id },
        data: {
          dependsOnIds: dependsOnIdsById.get(id) ?? [],
          positionX: pos.get(id)?.x ?? 0,
          positionY: pos.get(id)?.y ?? 0,
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
