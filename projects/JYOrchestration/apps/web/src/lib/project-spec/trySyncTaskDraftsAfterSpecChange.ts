import { syncTaskDraftsForProjectSpecVersion } from "@/lib/project-spec/taskDraftGenerationService";

export type TaskDraftSyncPayload = {
  ok: boolean;
  createdCount?: number;
  supersededCount?: number;
  message?: string;
  autoConfirmedTaskCount?: number;
  graphAutoRepaired?: boolean;
};

export async function trySyncTaskDraftsAfterSpecChange(params: {
  projectId: string;
  specVersionId: string;
  userId: string;
  model?: string | null;
}): Promise<TaskDraftSyncPayload> {
  try {
    const r = await syncTaskDraftsForProjectSpecVersion({
      projectId: params.projectId,
      specVersionId: params.specVersionId,
      userId: params.userId,
      model: params.model ?? undefined,
    });
    return {
      ok: true,
      createdCount: r.createdCount,
      supersededCount: r.supersededCount,
      autoConfirmedTaskCount: r.autoConfirmedTaskCount,
      graphAutoRepaired: r.graphAutoRepaired,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("trySyncTaskDraftsAfterSpecChange:", e);
    return { ok: false, message: msg };
  }
}
