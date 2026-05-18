import type { TaskDraftSyncResultDto } from "@/components/project-spec/types";

export function readTaskDraftSyncFromPayload(data: unknown): TaskDraftSyncResultDto | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const d = data as { taskDraftSync?: TaskDraftSyncResultDto };
  return d.taskDraftSync ?? null;
}
