import { parsePlanningSnapshotFromEventPayload } from "@/lib/planning-snapshot/planningSnapshotStructurePlan";
import { PLANNING_SNAPSHOT_EVENT_TYPE } from "@/lib/planning-snapshot/planningSnapshotModel";
import { buildRequirementsConversationHref } from "@/lib/project-structure/projectStructureExplainability";
import type {
  ProjectGraphActivityFeedDetail,
  ProjectGraphActivityFeedRow,
} from "@/lib/project-graph/projectGraphActivityClient";

const SNAPSHOT_CANDIDATE_TYPE_ORDER = ["Idea", "Problem", "Requirement", "Feature", "Actor"] as const;

export type ActivityFeedBuildInput = Readonly<{
  readonly projectId: string;
  readonly events: readonly Record<string, unknown>[];
  readonly candidates: readonly Record<string, unknown>[];
  readonly graphNodes: readonly Record<string, unknown>[];
  readonly graphEdges: readonly Record<string, unknown>[];
  readonly maxRows?: number;
}>;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function minuteBucket(iso: string): string {
  const s = String(iso ?? "").trim();
  if (s.length >= 16) return s.slice(0, 16);
  return s;
}

function readMeta(record: Record<string, unknown>): Record<string, unknown> | null {
  const raw = record.metadata ?? record.meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function isPlanningSnapshotCandidate(c: Record<string, unknown>): boolean {
  const meta = readMeta(c);
  return meta?.planningSnapshot === true;
}

function rawPayloadJson(payload: unknown): string | undefined {
  if (payload == null) return undefined;
  try {
    const text = JSON.stringify(payload, null, 2);
    if (!text || text === "{}") return undefined;
    return text;
  } catch {
    return undefined;
  }
}

function formatEventLine(eventType: string): string {
  if (eventType === PLANNING_SNAPSHOT_EVENT_TYPE) return "Planning Snapshot 생성";
  if (eventType === "conversation.message_created") return "원본 대화 저장";
  return `Event: ${eventType}`;
}

function countByType(candidates: readonly Record<string, unknown>[], sourceMessageId: string): Map<string, number> {
  const counts = new Map<string, number>();
  const sid = sourceMessageId.trim();
  for (const c of candidates) {
    if (!isPlanningSnapshotCandidate(c)) continue;
    if (String(c.sourceMessageId ?? "").trim() !== sid) continue;
    const nodeType = String(c.nodeType ?? c.entityType ?? "Candidate").trim() || "Candidate";
    counts.set(nodeType, (counts.get(nodeType) ?? 0) + 1);
  }
  return counts;
}

function countSnapshotGraphEdges(edges: readonly Record<string, unknown>[]): number {
  let n = 0;
  for (const e of edges) {
    const meta = readMeta(e);
    if (meta?.planningSnapshot === true) n += 1;
  }
  return n;
}

function countSnapshotGraphNodes(nodes: readonly Record<string, unknown>[], sourceMessageId: string): number {
  const sid = sourceMessageId.trim();
  let n = 0;
  for (const node of nodes) {
    const meta = readMeta(node);
    if (meta?.planningSnapshot !== true) continue;
    if (sid && String(meta.sourceMessageId ?? "").trim() !== sid) continue;
    n += 1;
  }
  return n;
}

function countApprovedSnapshotCandidates(candidates: readonly Record<string, unknown>[], sourceMessageId: string): number {
  const sid = sourceMessageId.trim();
  let n = 0;
  for (const c of candidates) {
    if (!isPlanningSnapshotCandidate(c)) continue;
    if (String(c.sourceMessageId ?? "").trim() !== sid) continue;
    if (String(c.lifecycleStatus ?? "") === "APPROVED") n += 1;
  }
  return n;
}

function buildPlanningSnapshotDetail(
  projectId: string,
  event: Record<string, unknown>,
  candidates: readonly Record<string, unknown>[],
  graphNodes: readonly Record<string, unknown>[],
  graphEdges: readonly Record<string, unknown>[],
): ProjectGraphActivityFeedDetail {
  const sourceMessageId = String(event.sourceMessageId ?? "").trim();
  const snapshot = parsePlanningSnapshotFromEventPayload(projectId, event.payload, sourceMessageId);
  const candidateCountsByType = Object.fromEntries(countByType(candidates, sourceMessageId));
  const graphEdgeCount = countSnapshotGraphEdges(graphEdges);
  const graphNodeCount = countSnapshotGraphNodes(graphNodes, sourceMessageId);
  const approvedCount = countApprovedSnapshotCandidates(candidates, sourceMessageId);
  const totalSnapshotCandidates = Object.values(candidateCountsByType).reduce((a, b) => a + b, 0);

  const statusBadges: string[] = [];
  if (totalSnapshotCandidates > 0) statusBadges.push("Candidate 생성 완료");
  if (graphNodeCount > 0 || graphEdgeCount > 0) statusBadges.push("Graph 반영 완료");
  if (totalSnapshotCandidates > 0 && approvedCount < totalSnapshotCandidates) {
    statusBadges.push("승인 대기");
  }

  const pid = projectId.trim();
  const requirementsHref = buildRequirementsConversationHref(pid, sourceMessageId);
  const structureReviewHref = pid ? `/projects/${encodeURIComponent(pid)}/structure-review` : null;

  return {
    view: "planning_snapshot",
    eventType: PLANNING_SNAPSHOT_EVENT_TYPE,
    stage: event.stage == null ? undefined : String(event.stage),
    entityId: event.id == null ? undefined : String(event.id),
    rawPayloadJson: rawPayloadJson(event.payload),
    planningSnapshot: {
      productName: snapshot?.productName ?? "프로젝트",
      summary: snapshot?.summary ?? "",
      problems: snapshot?.problems ?? [],
      actors: snapshot?.actors ?? [],
      features: snapshot?.features ?? [],
      candidateCountsByType,
      graphEdgeCount,
      graphNodeCount,
      approvedCount,
      statusBadges,
      requirementsHref,
      structureReviewHref,
      sourceMessageId,
      eventId: event.id == null ? undefined : String(event.id),
    },
  };
}

type InternalRow = ProjectGraphActivityFeedRow & { readonly sortAt: string; readonly sortOrder: number };

export function buildProjectGraphActivityFeed(input: ActivityFeedBuildInput): readonly ProjectGraphActivityFeedRow[] {
  const projectId = input.projectId.trim();
  const maxRows = input.maxRows ?? 24;
  const rows: InternalRow[] = [];
  let order = 0;

  const snapshotCandidateKeys = new Set<string>();

  for (const c of input.candidates) {
    if (!isPlanningSnapshotCandidate(c)) continue;
    const sid = String(c.sourceMessageId ?? "").trim();
    const sortAt = String(c.createdAt ?? "");
    snapshotCandidateKeys.add(`${sid}\0${minuteBucket(sortAt)}`);
  }

  for (const ev of input.events.slice(0, 30)) {
    const sortAt = String(ev.createdAt ?? "");
    if (!sortAt) continue;
    const eventType = String(ev.eventType ?? "event");
    const sourceMessageId = ev.sourceMessageId == null ? null : String(ev.sourceMessageId);
    const isSnapshot = eventType === PLANNING_SNAPSHOT_EVENT_TYPE;

    rows.push({
      id: `event:${String(ev.id ?? sortAt)}`,
      kind: "event",
      sortAt,
      sortOrder: order++,
      at: formatTime(sortAt),
      line: formatEventLine(eventType),
      sourceMessageId,
      detail: isSnapshot
        ? buildPlanningSnapshotDetail(projectId, ev, input.candidates, input.graphNodes, input.graphEdges)
        : {
            view: "default",
            eventType,
            stage: ev.stage == null ? undefined : String(ev.stage),
            entityId: ev.id == null ? undefined : String(ev.id),
            rawPayloadJson: rawPayloadJson(ev.payload),
          },
    });
  }

  for (const key of snapshotCandidateKeys) {
    const [sourceMessageId, bucket] = key.split("\0");
    const grouped = input.candidates.filter((c) => {
      if (!isPlanningSnapshotCandidate(c)) return false;
      return (
        String(c.sourceMessageId ?? "").trim() === sourceMessageId &&
        minuteBucket(String(c.createdAt ?? "")) === bucket
      );
    });
    if (grouped.length === 0) continue;
    const sortAt = grouped.map((c) => String(c.createdAt ?? "")).sort().reverse()[0] ?? bucket;

    const counts = countByType(input.candidates, sourceMessageId);
    for (const nodeType of SNAPSHOT_CANDIDATE_TYPE_ORDER) {
      const count = counts.get(nodeType) ?? 0;
      if (count <= 0) continue;
      rows.push({
        id: `group:candidate:${nodeType}:${sourceMessageId}:${bucket}`,
        kind: "group",
        sortAt,
        sortOrder: order++,
        at: formatTime(sortAt),
        line: `${nodeType} 후보 ${count}개 생성`,
        sourceMessageId: sourceMessageId || null,
        detail: {
          view: "group_summary",
          groupSummary: { nodeType, count, sourceMessageId },
        },
      });
    }

    const edgeCount = countSnapshotGraphEdges(input.graphEdges);
    if (edgeCount > 0) {
      rows.push({
        id: `group:edges:${sourceMessageId}:${bucket}`,
        kind: "group",
        sortAt,
        sortOrder: order++,
        at: formatTime(sortAt),
        line: `Graph Edge ${edgeCount}개 생성`,
        sourceMessageId: sourceMessageId || null,
        detail: {
          view: "group_summary",
          groupSummary: { nodeType: "GraphEdge", count: edgeCount, sourceMessageId },
        },
      });
    }
  }

  for (const c of input.candidates.slice(0, 40)) {
    if (isPlanningSnapshotCandidate(c)) continue;
    const sortAt = String(c.createdAt ?? "");
    if (!sortAt) continue;
    const nodeType = String(c.nodeType ?? c.entityType ?? "");
    const title = String(c.title ?? c.name ?? "후보");
    rows.push({
      id: `candidate:${String(c.id ?? sortAt)}`,
      kind: "candidate",
      sortAt,
      sortOrder: order++,
      at: formatTime(sortAt),
      line: `Candidate: ${nodeType ? `${nodeType} · ` : ""}${title}`,
      sourceMessageId: c.sourceMessageId == null ? null : String(c.sourceMessageId),
      detail: {
        view: "default",
        title,
        lifecycleStatus: c.lifecycleStatus == null ? undefined : String(c.lifecycleStatus),
        summary: c.summary == null ? undefined : String(c.summary),
        entityId: c.id == null ? undefined : String(c.id),
      },
    });
  }

  rows.sort((a, b) => {
    const byTime = b.sortAt.localeCompare(a.sortAt);
    if (byTime !== 0) return byTime;
    return a.sortOrder - b.sortOrder;
  });

  return rows.slice(0, maxRows).map(({ sortAt: _s, sortOrder: _o, ...row }) => row);
}
