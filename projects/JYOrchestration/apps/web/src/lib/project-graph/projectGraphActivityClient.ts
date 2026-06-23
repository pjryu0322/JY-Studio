import { buildProjectGraphActivityFeed } from "@/lib/project-graph/projectGraphActivityFeed";

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

export type PlanningSnapshotActivityContext = Readonly<{
  readonly productName: string;
  readonly summary: string;
  readonly problems: readonly string[];
  readonly actors: readonly string[];
  readonly features: readonly string[];
  readonly candidateCountsByType: Readonly<Record<string, number>>;
  readonly graphEdgeCount: number;
  readonly graphNodeCount: number;
  readonly approvedCount: number;
  readonly statusBadges: readonly string[];
  readonly requirementsHref: string | null;
  readonly structureReviewHref: string | null;
  readonly sourceMessageId: string;
  readonly eventId?: string;
}>;

export type ProjectGraphActivityFeedDetail = Readonly<{
  readonly view?: "planning_snapshot" | "group_summary" | "default";
  readonly eventType?: string;
  readonly stage?: string;
  readonly lifecycleStatus?: string;
  readonly title?: string;
  readonly summary?: string;
  /** 개발자 Accordion 전용 — 기본 UI에 노출하지 않음 */
  readonly rawPayloadJson?: string;
  readonly entityId?: string;
  readonly planningSnapshot?: PlanningSnapshotActivityContext;
  readonly groupSummary?: Readonly<{ readonly nodeType: string; readonly count: number; readonly sourceMessageId?: string }>;
}>;

export type ProjectGraphActivityFeedRow = Readonly<{
  readonly id: string;
  readonly kind: "event" | "candidate" | "group";
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

  const feed = buildProjectGraphActivityFeed({
    projectId: pid,
    events,
    candidates,
    graphNodes: nodes,
    graphEdges: edges,
    maxRows: 24,
  });

  const lastSyncedAt = sync ? new Date().toISOString() : null;

  return {
    eventCount: events.length,
    candidateCount: candidates.length,
    approvedNodeCount: approvedNodes.length,
    edgeCount: edges.length,
    conflictCount: conflicts.length,
    lastSyncedAt,
    feed,
    recentCandidates,
    recentApprovedNodes,
  };
}
