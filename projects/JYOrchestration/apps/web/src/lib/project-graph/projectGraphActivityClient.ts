type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

export type ProjectGraphActivityFeedDetail = Readonly<{
  readonly eventType?: string;
  readonly stage?: string;
  readonly lifecycleStatus?: string;
  readonly title?: string;
  readonly summary?: string;
  readonly payloadPreview?: string;
  readonly entityId?: string;
}>;

export type ProjectGraphActivityFeedRow = Readonly<{
  readonly id: string;
  readonly kind: "event" | "candidate";
  readonly at: string;
  readonly line: string;
  readonly sourceMessageId?: string | null;
  readonly detail: ProjectGraphActivityFeedDetail;
}>;

export type ProjectGraphActivitySummary = Readonly<{
  readonly eventCount: number;
  readonly candidateCount: number;
  readonly approvedNodeCount: number;
  readonly edgeCount: number;
  readonly conflictCount: number;
  readonly lastSyncedAt: string | null;
  readonly feed: readonly ProjectGraphActivityFeedRow[];
  readonly recentCandidates: readonly { readonly title: string; readonly nodeType: string; readonly at: string }[];
  readonly recentApprovedNodes: readonly { readonly title: string; readonly nodeType: string }[];
}>;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function payloadPreview(payload: unknown): string | undefined {
  if (payload == null) return undefined;
  try {
    const text = JSON.stringify(payload);
    if (!text || text === "{}") return undefined;
    return text.length > 480 ? `${text.slice(0, 477)}…` : text;
  } catch {
    return undefined;
  }
}

export async function loadProjectGraphActivitySummary(
  projectId: string,
  options?: Readonly<{ readonly sync?: boolean }>,
): Promise<ProjectGraphActivitySummary> {
  const pid = projectId.trim();
  if (!pid) throw new Error("projectId가 필요합니다.");

  const sync = options?.sync === true;
  const enc = encodeURIComponent(pid);

  if (sync) {
    await fetch(`/api/projects/${enc}/structure/candidates?sync=true`, { credentials: "include", cache: "no-store" });
    await fetch(`/api/projects/${enc}/graph?sync=true&limit=1`, { credentials: "include", cache: "no-store" });
  }

  const [eventsRes, conflictsRes, graphRes, candidatesRes] = await Promise.all([
    fetch(`/api/projects/${enc}/events?limit=80`, { credentials: "include", cache: "no-store" }),
    fetch(`/api/projects/${enc}/structure/conflicts`, { credentials: "include", cache: "no-store" }),
    fetch(`/api/projects/${enc}/graph?limit=500`, { credentials: "include", cache: "no-store" }),
    fetch(`/api/projects/${enc}/structure/candidates`, { credentials: "include", cache: "no-store" }),
  ]);

  const eventsJson = (await eventsRes.json()) as ApiEnvelope<{ events?: Record<string, unknown>[] }>;
  const conflictsJson = (await conflictsRes.json()) as ApiEnvelope<{ conflicts?: unknown[] }>;
  const graphJson = (await graphRes.json()) as ApiEnvelope<{ nodes?: Record<string, unknown>[]; edges?: unknown[] }>;
  const candidatesJson = (await candidatesRes.json()) as ApiEnvelope<{
    candidates?: Record<string, unknown>[];
    syncStats?: { syncedAt?: string };
  }>;

  const events = Array.isArray(eventsJson.data?.events) ? eventsJson.data!.events! : [];
  const candidates = Array.isArray(candidatesJson.data?.candidates) ? candidatesJson.data!.candidates! : [];
  const nodes = Array.isArray(graphJson.data?.nodes) ? graphJson.data!.nodes! : [];
  const edges = Array.isArray(graphJson.data?.edges) ? graphJson.data!.edges! : [];
  const conflicts = Array.isArray(conflictsJson.data?.conflicts) ? conflictsJson.data!.conflicts! : [];

  const approvedNodes = nodes.filter((n) => String(n.lifecycleStatus ?? "") === "APPROVED");

  const recentCandidates = [...candidates]
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
    .slice(0, 5)
    .map((c) => ({
      title: String(c.title ?? c.name ?? "후보"),
      nodeType: String(c.nodeType ?? c.entityType ?? ""),
      at: String(c.createdAt ?? ""),
    }));

  const recentApprovedNodes = approvedNodes.slice(0, 5).map((n) => ({
    title: String(n.title ?? ""),
    nodeType: String(n.nodeType ?? ""),
  }));

  const feed: Array<ProjectGraphActivityFeedRow & { readonly sortAt: string }> = [];

  for (const ev of events.slice(0, 15)) {
    const sortAt = String(ev.createdAt ?? "");
    const eventType = String(ev.eventType ?? "event");
    feed.push({
      id: `event:${String(ev.id ?? sortAt)}`,
      kind: "event",
      sortAt,
      at: sortAt,
      line: `Event: ${eventType}`,
      sourceMessageId: ev.sourceMessageId == null ? null : String(ev.sourceMessageId),
      detail: {
        eventType,
        stage: ev.stage == null ? undefined : String(ev.stage),
        payloadPreview: payloadPreview(ev.payload),
        entityId: ev.id == null ? undefined : String(ev.id),
      },
    });
  }

  for (const c of candidates.slice(0, 20)) {
    const sortAt = String(c.createdAt ?? "");
    if (!sortAt) continue;
    const nodeType = String(c.nodeType ?? c.entityType ?? "");
    const title = String(c.title ?? c.name ?? "후보");
    feed.push({
      id: `candidate:${String(c.id ?? sortAt)}`,
      kind: "candidate",
      sortAt,
      at: sortAt,
      line: `Candidate: ${nodeType ? `${nodeType} · ` : ""}${title}`,
      sourceMessageId: c.sourceMessageId == null ? null : String(c.sourceMessageId),
      detail: {
        title,
        lifecycleStatus: c.lifecycleStatus == null ? undefined : String(c.lifecycleStatus),
        summary: c.summary == null ? undefined : String(c.summary),
        entityId: c.id == null ? undefined : String(c.id),
      },
    });
  }

  feed.sort((a, b) => b.sortAt.localeCompare(a.sortAt));

  const lastSyncedAt = sync ? new Date().toISOString() : null;

  return {
    eventCount: events.length,
    candidateCount: candidates.length,
    approvedNodeCount: approvedNodes.length,
    edgeCount: edges.length,
    conflictCount: conflicts.length,
    lastSyncedAt,
    feed: feed.slice(0, 24).map((row) => ({
      id: row.id,
      kind: row.kind,
      at: formatTime(row.at),
      line: row.line,
      sourceMessageId: row.sourceMessageId,
      detail: row.detail,
    })),
    recentCandidates,
    recentApprovedNodes,
  };
}
