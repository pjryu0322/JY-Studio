import type {
  ImplementationDeveloperMemoryDraft,
  ImplementationWorkingQueueItem,
} from "@/lib/prototype/implementationWorkingQueueTypes";
import { riskLevelLabelKo } from "@/lib/prototype/implementationWorkingQueueClassifier";

export function buildDeveloperMemoryDraftFromQueue(input: {
  readonly projectId: string;
  readonly items: readonly ImplementationWorkingQueueItem[];
  readonly latestPreviewUrl?: string | null;
  readonly prior?: ImplementationDeveloperMemoryDraft | null;
}): ImplementationDeveloperMemoryDraft {
  const now = new Date().toISOString();
  const pendingIds = input.items.filter((i) => i.status === "pending").map((i) => i.id);
  const highRisk = input.items.filter((i) => i.riskLevel === "high" && i.status === "pending");
  const knownRisks = [
    ...(input.prior?.knownRisks ?? []),
    ...highRisk.map((i) => `${i.title}: ${riskLevelLabelKo(i.riskLevel)}`),
  ].slice(-20);
  const focus =
    input.items.find((i) => i.status === "pending")?.title ??
    input.items.find((i) => i.status === "approved")?.title ??
    input.prior?.currentFocus;
  return {
    projectId: input.projectId.trim(),
    currentFocus: focus,
    latestPreviewUrl: input.latestPreviewUrl?.trim() || input.prior?.latestPreviewUrl,
    knownRisks: [...new Set(knownRisks)],
    pendingQueueItemIds: pendingIds,
    updatedAt: now,
  };
}
