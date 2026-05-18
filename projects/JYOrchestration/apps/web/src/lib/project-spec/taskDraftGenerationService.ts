import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";
import { legacyPipelineGenerateTaskDraftsWithOpenAI } from "@/lib/project-spec/generateTaskDraftsWithOpenAI";
import { singlePassGenerateTaskDraftsWithOpenAI } from "@/lib/project-spec/singlePassTaskDraftOpenAI";
import { stageForNodeType, withNodeTypePrefix, stripNodeTypePrefix } from "@/lib/project-spec/taskDraftHierarchy";
import type { TaskNodeType } from "@/lib/project-spec/taskDraftHierarchy";
import { finalizeAiGeneratedTaskDraftGraph } from "@/lib/project-spec/taskDraftRegenerationGraph";
import { confirmTaskDraftsInTransaction } from "@/lib/project-spec/confirmTaskDraftsService";

export type TaskDraftSyncResult = {
  supersededCount: number;
  createdCount: number;
  model: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  } | null;
  /** true when deps/layout were adjusted after AI output to form a valid DAG */
  graphAutoRepaired?: boolean;
  /** [T] 노드에서 생성된 Task 수 */
  autoConfirmedTaskCount?: number;
  confirmedTaskIds?: string[];
  promotedDraftRows?: number;
};

export type TaskDraftGenerationMode = "single_pass" | "legacy_pipeline";

export type SyncTaskDraftsForProjectSpecVersionParams = {
  projectId: string;
  specVersionId: string;
  userId: string;
  model?: string | null;
  /** 기본 `single_pass`. 레거시 다단계 파이프라인만 `legacy_pipeline`. */
  generationMode?: TaskDraftGenerationMode;
  /** legacy_pipeline 전용: 비기능 파이프라인 힌트 */
  includeNonFunctionalInExecutionPipeline?: boolean;
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

function extractPrimaryTaskLimitFromPrompt(prompt: string | null | undefined): number | null {
  const p = String(prompt ?? "");
  if (!p) return null;

  const normalized = p
    .replace(/\s+/g, "")
    .replace(/[–—〜－]/g, "-");

  if (/2[,~\-]3(개)?/.test(normalized) || /3[,~\-]2(개)?/.test(normalized)) return 3;

  if (
    /2개.*3개.*개(만|이내|까지|정도)/.test(normalized) ||
    /3개.*2개.*개(만|이내|까지|정도)/.test(normalized)
  ) {
    return 3;
  }

  if (/3개(만|이내|까지)?/.test(normalized)) return 3;
  if (/2개(만|이내|까지)?/.test(normalized)) return 2;

  return null;
}

function mapUsage(u: { promptTokens: number; completionTokens: number; totalTokens: number } | null | undefined) {
  if (!u) return null;
  return {
    promptTokens: u.promptTokens,
    completionTokens: u.completionTokens,
    totalTokens: u.totalTokens,
  };
}

/**
 * 단일 OpenAI 호출 → 실행 Task 초안만 생성·확정.
 */
export async function singlePassSyncTaskDraftsForProjectSpecVersion(
  params: Omit<SyncTaskDraftsForProjectSpecVersionParams, "generationMode" | "includeNonFunctionalInExecutionPipeline">
): Promise<TaskDraftSyncResult> {
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
        taskGenerationPrompt: true,
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

  const ai = await singlePassGenerateTaskDraftsWithOpenAI({
    projectName: projectRow.name,
    projectDescription: projectRow.description,
    projectType: projectRow.projectType,
    specMarkdown,
    modelFromRequest: model,
    taskGenerationPromptTemplate: projectRow.taskGenerationPrompt,
  });

  appendTaskProgressLog({
    kind: "task_drafts",
    phase: "openai_complete",
    projectId,
    specVersionId,
    userId,
    detail: {
      mode: "single_pass",
      model: ai.model,
      taskCount: ai.tasks.length,
      usage: ai.usage ?? null,
    },
  });

  const result = await prisma.$transaction(async (tx) => {
    const sup = await tx.taskDraft.updateMany({
      where: { projectId, status: "DRAFT" },
      data: { status: "SUPERSEDED" },
    });

    const createdRows: CreatedRowMeta[] = [];
    const depsById = new Map<string, string[]>();

    let prevId: string | null = null;
    for (let i = 0; i < ai.tasks.length; i++) {
      const t = ai.tasks[i];
      const depIds: string[] = prevId ? [prevId] : [];
      const row: {
        id: string;
        title: string;
        description: string | null;
        priority: string;
        createdAt: Date;
      } = await tx.taskDraft.create({
        data: {
          projectId,
          specVersionId,
          title: withNodeTypePrefix("task", t.title),
          description: t.description || null,
          priority: t.priority,
          dependsOn: [],
          dependsOnIds: depIds,
          acceptanceCriteria: undefined,
          taskInput: null,
          taskOutput: null,
          estimatedSize: null,
          executionKind: t.executionKind,
          positionX: 0,
          positionY: i * 140,
          stage: stageForNodeType("task"),
          createdByType: "AI",
          status: "DRAFT",
          sourceModel: ai.model,
          promptTokens: i === 0 ? (ai.usage?.promptTokens ?? null) : null,
          completionTokens: i === 0 ? (ai.usage?.completionTokens ?? null) : null,
          totalTokens: i === 0 ? (ai.usage?.totalTokens ?? null) : null,
          createdByUserId: userId,
        },
        select: { id: true, title: true, description: true, priority: true, createdAt: true },
      });
      createdRows.push({
        id: row.id,
        type: "task",
        title: row.title,
        description: row.description,
        priority: row.priority,
        createdAt: row.createdAt,
        parentTitle: null,
      });
      depsById.set(row.id, depIds);
      prevId = row.id;
    }

    let graphAutoRepaired = false;
    let autoConfirmedTaskCount = 0;
    let confirmedTaskIds: string[] = [];
    let promotedDraftRows = 0;
    if (createdRows.length > 0) {
      const fin = finalizeAiGeneratedTaskDraftGraph(createdRows, depsById);
      graphAutoRepaired = fin.graphAutoRepaired;
      for (const row of createdRows) {
        const p = fin.positionById.get(row.id);
        const stage = fin.stageById.get(row.id) ?? stageForNodeType(row.type);
        await tx.taskDraft.update({
          where: { id: row.id },
          data: {
            dependsOnIds: fin.finalDepsById.get(row.id) ?? [],
            dependsOn: [],
            positionX: p?.x ?? 0,
            positionY: p?.y ?? 0,
            stage,
            createdByType: "AI",
          },
        });
      }

      const toPromote = await tx.taskDraft.findMany({
        where: {
          projectId,
          status: "DRAFT",
          id: { in: createdRows.map((r) => r.id) },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const cr = await confirmTaskDraftsInTransaction(tx, { projectId, drafts: toPromote });
      autoConfirmedTaskCount = cr.confirmedCount;
      confirmedTaskIds = cr.taskIds;
      promotedDraftRows = cr.promotedDraftRows ?? 0;
    }

    return {
      supersededCount: sup.count,
      createdCount: createdRows.length,
      graphAutoRepaired: createdRows.length > 0 ? graphAutoRepaired : false,
      autoConfirmedTaskCount,
      confirmedTaskIds,
      promotedDraftRows,
    };
  });

  appendTaskProgressLog({
    kind: "task_drafts",
    phase: "sync_complete",
    projectId,
    specVersionId,
    userId,
    detail: {
      mode: "single_pass",
      supersededCount: result.supersededCount,
      createdCount: result.createdCount,
      graphAutoRepaired: result.graphAutoRepaired,
      autoConfirmedTaskCount: result.autoConfirmedTaskCount,
      confirmedTaskIds: result.confirmedTaskIds,
      promotedDraftRows: result.promotedDraftRows,
    },
  });

  return {
    supersededCount: result.supersededCount,
    createdCount: result.createdCount,
    model: ai.model,
    usage: mapUsage(ai.usage),
    graphAutoRepaired: result.graphAutoRepaired,
    autoConfirmedTaskCount: result.autoConfirmedTaskCount,
    confirmedTaskIds: result.confirmedTaskIds,
    promotedDraftRows: result.promotedDraftRows,
  };
}

/**
 * 레거시 다단계 OpenAI 파이프라인 (요구→설계→기능→실행).
 */
export async function legacyPipelineSyncTaskDraftsForProjectSpecVersion(
  params: Omit<SyncTaskDraftsForProjectSpecVersionParams, "generationMode">
): Promise<TaskDraftSyncResult> {
  const { projectId, specVersionId, userId, model, includeNonFunctionalInExecutionPipeline } = params;

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
        taskPrompt: true,
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

  const ai = await legacyPipelineGenerateTaskDraftsWithOpenAI({
    projectName: projectRow.name,
    projectDescription: projectRow.description,
    projectType: projectRow.projectType,
    taskPromptTemplate: projectRow.taskPrompt,
    specCoreGoals: projectRow.specCoreGoals,
    specScopeIn: projectRow.specScopeIn,
    specScopeOut: projectRow.specScopeOut,
    specTargetUsers: projectRow.specTargetUsers,
    specSuccessCriteria: projectRow.specSuccessCriteria,
    specMarkdown,
    modelFromRequest: model,
    includeNonFunctionalInExecutionPipeline: Boolean(includeNonFunctionalInExecutionPipeline),
  });

  appendTaskProgressLog({
    kind: "task_drafts",
    phase: "openai_complete",
    projectId,
    specVersionId,
    userId,
    detail: {
      mode: "legacy_pipeline",
      model: ai.model,
      itemCount: ai.tasks.length,
      usage: ai.usage ?? null,
    },
  });

  const hierarchyItems = ai.tasks.filter((t) => t.type !== "task");
  const taskItemsRaw = ai.tasks.filter((t) => t.type === "task");
  const primaryTaskLimit = extractPrimaryTaskLimitFromPrompt(projectRow.taskPrompt);
  console.info("[task-drafts] primaryTaskLimit extract (legacy)", {
    primaryTaskLimit,
    hasTaskPrompt: Boolean(projectRow.taskPrompt),
    taskPromptPreview: String(projectRow.taskPrompt ?? "").slice(0, 90),
    totalPrimaryGenerated: taskItemsRaw.length,
  });
  const taskItems =
    primaryTaskLimit != null ? taskItemsRaw.slice(0, primaryTaskLimit) : taskItemsRaw;
  if (primaryTaskLimit != null) {
    console.info("[task-drafts] primary task limit applied (legacy)", {
      primaryTaskLimit,
      generatedPrimaryTasks: taskItemsRaw.length,
      keptPrimaryTasks: taskItems.length,
    });
  }

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

    let graphAutoRepaired = false;
    let autoConfirmedTaskCount = 0;
    let confirmedTaskIds: string[] = [];
    let promotedDraftRows = 0;
    if (createdRows.length > 0) {
      const fin = finalizeAiGeneratedTaskDraftGraph(createdRows, depsById);
      graphAutoRepaired = fin.graphAutoRepaired;
      for (const row of createdRows) {
        const p = fin.positionById.get(row.id);
        const stage = fin.stageById.get(row.id) ?? stageForNodeType(row.type);
        await tx.taskDraft.update({
          where: { id: row.id },
          data: {
            dependsOnIds: fin.finalDepsById.get(row.id) ?? [],
            dependsOn: [],
            positionX: p?.x ?? 0,
            positionY: p?.y ?? 0,
            stage,
            createdByType: "AI",
          },
        });
      }

      const toPromote = await tx.taskDraft.findMany({
        where: {
          projectId,
          status: "DRAFT",
          id: { in: createdRows.map((r) => r.id) },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const cr = await confirmTaskDraftsInTransaction(tx, { projectId, drafts: toPromote });
      autoConfirmedTaskCount = cr.confirmedCount;
      confirmedTaskIds = cr.taskIds;
      promotedDraftRows = cr.promotedDraftRows ?? 0;
    }

    return {
      supersededCount: sup.count,
      createdCount: createdRows.length,
      graphAutoRepaired: createdRows.length > 0 ? graphAutoRepaired : false,
      autoConfirmedTaskCount,
      confirmedTaskIds,
      promotedDraftRows,
    };
  });

  appendTaskProgressLog({
    kind: "task_drafts",
    phase: "sync_complete",
    projectId,
    specVersionId,
    userId,
    detail: {
      mode: "legacy_pipeline",
      supersededCount: result.supersededCount,
      createdCount: result.createdCount,
      graphAutoRepaired: result.graphAutoRepaired,
      autoConfirmedTaskCount: result.autoConfirmedTaskCount,
      confirmedTaskIds: result.confirmedTaskIds,
      promotedDraftRows: result.promotedDraftRows,
    },
  });

  return {
    supersededCount: result.supersededCount,
    createdCount: result.createdCount,
    model: ai.model,
    usage: mapUsage(ai.usage),
    graphAutoRepaired: result.graphAutoRepaired,
    autoConfirmedTaskCount: result.autoConfirmedTaskCount,
    confirmedTaskIds: result.confirmedTaskIds,
    promotedDraftRows: result.promotedDraftRows,
  };
}

/**
 * OpenAI로 Task 초안을 생성하고, 기존 DRAFT는 SUPERSEDED로 바꾼 뒤 새 행을 저장한다.
 * 기본은 `single_pass` (OpenAI 1회). `legacy_pipeline`은 예전 다단계 파이프라인.
 */
export async function syncTaskDraftsForProjectSpecVersion(
  params: SyncTaskDraftsForProjectSpecVersionParams
): Promise<TaskDraftSyncResult> {
  const mode: TaskDraftGenerationMode = params.generationMode ?? "single_pass";
  if (mode === "legacy_pipeline") {
    return legacyPipelineSyncTaskDraftsForProjectSpecVersion(params);
  }
  return singlePassSyncTaskDraftsForProjectSpecVersion(params);
}
