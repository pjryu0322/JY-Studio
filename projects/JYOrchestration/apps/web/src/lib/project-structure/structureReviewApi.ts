import type {
  StructureCandidateEdgeRow,
  StructureCandidateRow,
  StructureConflictRow,
} from "@/lib/project-structure/structureReviewUiTypes";
import { normalizeConfidenceLabel } from "@/lib/project-structure/structureExplainabilityModel";

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

function parseExplainability(raw: unknown): StructureCandidateRow["explainability"] | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const e = raw as Record<string, unknown>;
  const labelRaw = String(e.confidenceLabel ?? "");
  const normalized = normalizeConfidenceLabel(labelRaw);
  const label =
    normalized === "HIGH" ? "High" : normalized === "MEDIUM" ? "Medium" : normalized === "LOW" ? "Low" : null;
  if (!label) return undefined;
  const sc = e.sourceConversation;
  const se = e.sourceEvent;
  const cf = e.createdFrom;
  return {
    confidence: Number(e.confidence ?? 0),
    confidenceLabel: label,
    reason: String(e.reason ?? ""),
    confidenceReason: String(e.confidenceReason ?? ""),
    sourceConversation:
      sc && typeof sc === "object" && !Array.isArray(sc)
        ? {
            excerpt: String((sc as Record<string, unknown>).excerpt ?? ""),
            messageId:
              (sc as Record<string, unknown>).messageId == null
                ? null
                : String((sc as Record<string, unknown>).messageId),
            href:
              (sc as Record<string, unknown>).href == null
                ? null
                : String((sc as Record<string, unknown>).href),
          }
        : { excerpt: "", messageId: null, href: null },
    sourceEvent:
      se && typeof se === "object" && !Array.isArray(se)
        ? {
            eventType: String((se as Record<string, unknown>).eventType ?? ""),
            eventId:
              (se as Record<string, unknown>).eventId == null
                ? null
                : String((se as Record<string, unknown>).eventId),
          }
        : { eventType: "", eventId: null },
    createdBy: String(e.createdBy ?? ""),
    createdFrom:
      cf && typeof cf === "object" && !Array.isArray(cf)
        ? {
            eventId:
              (cf as Record<string, unknown>).eventId == null
                ? null
                : String((cf as Record<string, unknown>).eventId),
            messageId:
              (cf as Record<string, unknown>).messageId == null
                ? null
                : String((cf as Record<string, unknown>).messageId),
          }
        : { eventId: null, messageId: null },
  };
}

function parseCandidate(raw: unknown): StructureCandidateRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? "").trim();
  if (!id) return null;
  const explainability =
    parseExplainability(r.explainability) ??
    (r.reason && r.confidenceLabel
      ? parseExplainability({
          confidence: r.confidence,
          confidenceLabel: r.confidenceLabel,
          reason: r.reason,
          sourceConversation: r.sourceConversation,
          sourceEvent: r.sourceEvent,
          createdBy: r.createdBy,
          createdFrom: r.createdFrom,
        })
      : undefined);
  return {
    id,
    projectId: String(r.projectId ?? ""),
    idempotencyKey: String(r.idempotencyKey ?? ""),
    nodeType: String(r.nodeType ?? ""),
    title: String(r.title ?? ""),
    summary: String(r.summary ?? ""),
    lifecycleStatus: String(r.lifecycleStatus ?? "CANDIDATE"),
    sourceEventId: r.sourceEventId == null ? null : String(r.sourceEventId),
    fingerprint: r.fingerprint == null ? null : String(r.fingerprint),
    approvedGraphNodeId: r.approvedGraphNodeId == null ? null : String(r.approvedGraphNodeId),
    metadata: r.metadata,
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
    explainability,
    confidence: r.confidence == null ? explainability?.confidence : Number(r.confidence),
    confidenceLabel:
      r.confidenceLabel == null ? explainability?.confidenceLabel : String(r.confidenceLabel),
    reason: r.reason == null ? explainability?.reason : String(r.reason),
    sourceConversation: explainability?.sourceConversation,
    sourceEvent: explainability?.sourceEvent,
    createdBy: r.createdBy == null ? explainability?.createdBy : String(r.createdBy),
    createdFrom: explainability?.createdFrom,
  };
}

export async function fetchStructureCandidates(projectId: string, input?: { sync?: boolean; lifecycle?: string }) {
  const pid = encodeURIComponent(projectId.trim());
  const params = new URLSearchParams();
  if (input?.sync) params.set("sync", "true");
  if (input?.lifecycle?.trim()) params.set("lifecycle", input.lifecycle.trim());
  const qs = params.toString();
  const res = await fetch(`/api/projects/${pid}/structure/candidates${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as ApiEnvelope<{
    candidates?: unknown[];
    edges?: unknown[];
    syncStats?: unknown;
  }>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? "구조 후보를 불러오지 못했습니다.");
  }
  const candidates = (json.data.candidates ?? []).map(parseCandidate).filter((c): c is StructureCandidateRow => Boolean(c));
  const edges = (json.data.edges ?? []) as StructureCandidateEdgeRow[];
  return { candidates, edges, syncStats: json.data.syncStats ?? null };
}

export async function fetchStructureConflicts(projectId: string) {
  const pid = encodeURIComponent(projectId.trim());
  const res = await fetch(`/api/projects/${pid}/structure/conflicts`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as ApiEnvelope<{ conflicts?: StructureConflictRow[] }>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? "충돌 목록을 불러오지 못했습니다.");
  }
  return { conflicts: json.data.conflicts ?? [] };
}

export async function postStructureApprove(projectId: string, candidateIds: string[]) {
  const pid = encodeURIComponent(projectId.trim());
  const res = await fetch(`/api/projects/${pid}/structure/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds }),
  });
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "승인에 실패했습니다.");
  return json.data;
}

export async function postStructureReject(projectId: string, candidateIds: string[], reason?: string) {
  const pid = encodeURIComponent(projectId.trim());
  const res = await fetch(`/api/projects/${pid}/structure/reject`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds, reason }),
  });
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "거절에 실패했습니다.");
  return json.data;
}

export async function postStructureMerge(
  projectId: string,
  sourceCandidateId: string,
  targetCandidateId: string,
) {
  const pid = encodeURIComponent(projectId.trim());
  const res = await fetch(`/api/projects/${pid}/structure/merge`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceCandidateId, targetCandidateId }),
  });
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "병합에 실패했습니다.");
  return json.data;
}

export async function patchStructureEdit(
  projectId: string,
  input: { candidateId: string; title?: string; summary?: string },
) {
  const pid = encodeURIComponent(projectId.trim());
  const res = await fetch(`/api/projects/${pid}/structure/edit`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as ApiEnvelope<{ candidate?: unknown }>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "수정에 실패했습니다.");
  return json.data;
}
