import type {
  ImplementationDeveloperMemoryDraft,
  ImplementationWorkingQueueItem,
  ImplementationWorkingQueueV1,
} from "@/lib/prototype/implementationWorkingQueueTypes";

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function normalizeItem(raw: unknown, fallbackProjectId: string): ImplementationWorkingQueueItem | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const projectId =
    typeof raw.projectId === "string" ? raw.projectId.trim() : fallbackProjectId.trim();
  const rawUserMessage = typeof raw.rawUserMessage === "string" ? raw.rawUserMessage.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : rawUserMessage;
  const status = raw.status;
  const affectedArea = raw.affectedArea;
  const riskLevel = raw.riskLevel;
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : createdAt;
  if (!id || !rawUserMessage || !title) return null;
  const validStatus =
    status === "pending" ||
    status === "approved" ||
    status === "running" ||
    status === "completed" ||
    status === "rejected" ||
    status === "deferred"
      ? status
      : "pending";
  const validArea =
    affectedArea === "ui" ||
    affectedArea === "flow" ||
    affectedArea === "feature" ||
    affectedArea === "data" ||
    affectedArea === "style" ||
    affectedArea === "bug" ||
    affectedArea === "unknown"
      ? affectedArea
      : "unknown";
  const validRisk =
    riskLevel === "low" || riskLevel === "medium" || riskLevel === "high" ? riskLevel : "low";
  return {
    id,
    projectId,
    sourceMessageId:
      typeof raw.sourceMessageId === "string" ? raw.sourceMessageId.trim() || undefined : undefined,
    rawUserMessage,
    title,
    description,
    affectedArea: validArea,
    status: validStatus,
    riskLevel: validRisk,
    createdAt,
    updatedAt,
  };
}

export function parseImplementationWorkingQueueV1(
  raw: unknown,
  fallbackProjectId: string,
): ImplementationWorkingQueueV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!isRecord(raw)) return null;
  const projectId =
    typeof raw.projectId === "string" ? raw.projectId.trim() : fallbackProjectId.trim();
  if (!projectId) return null;
  const itemsRaw = raw.items;
  const items: ImplementationWorkingQueueItem[] = [];
  if (Array.isArray(itemsRaw)) {
    for (const it of itemsRaw) {
      const norm = normalizeItem(it, projectId);
      if (norm) items.push(norm);
    }
  }
  return {
    version: "implementation_working_queue_v1",
    projectId,
    items,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export function readImplementationWorkingQueueFromState(
  requirementsStateJson: unknown,
  projectId: string,
): ImplementationWorkingQueueV1 {
  const o = isRecord(requirementsStateJson) ? requirementsStateJson : {};
  const parsed = parseImplementationWorkingQueueV1(o.implementationWorkingQueueV1, projectId);
  if (parsed?.items) return parsed;
  const pid = projectId.trim();
  return {
    version: "implementation_working_queue_v1",
    projectId: pid,
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

export function parseImplementationDeveloperMemoryDraftV1(
  raw: unknown,
  fallbackProjectId: string,
): ImplementationDeveloperMemoryDraft | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!isRecord(raw)) return null;
  const projectId =
    typeof raw.projectId === "string" ? raw.projectId.trim() : fallbackProjectId.trim();
  if (!projectId) return null;
  const knownRisks: string[] = [];
  if (Array.isArray(raw.knownRisks)) {
    for (const r of raw.knownRisks) {
      const s = String(r ?? "").trim();
      if (s) knownRisks.push(s);
    }
  }
  const pendingQueueItemIds: string[] = [];
  if (Array.isArray(raw.pendingQueueItemIds)) {
    for (const id of raw.pendingQueueItemIds) {
      const s = String(id ?? "").trim();
      if (s) pendingQueueItemIds.push(s);
    }
  }
  return {
    projectId,
    currentFocus: typeof raw.currentFocus === "string" ? raw.currentFocus.trim() || undefined : undefined,
    latestPreviewUrl:
      typeof raw.latestPreviewUrl === "string" ? raw.latestPreviewUrl.trim() || undefined : undefined,
    knownRisks,
    pendingQueueItemIds,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export function readImplementationDeveloperMemoryDraftFromState(
  requirementsStateJson: unknown,
  projectId: string,
): ImplementationDeveloperMemoryDraft | null {
  const o = isRecord(requirementsStateJson) ? requirementsStateJson : {};
  const parsed = parseImplementationDeveloperMemoryDraftV1(o.implementationDeveloperMemoryDraftV1, projectId);
  return parsed ?? null;
}
