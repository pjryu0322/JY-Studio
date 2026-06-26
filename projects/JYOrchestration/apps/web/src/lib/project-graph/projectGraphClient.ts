import {
  toStructureExplainability,
  type StructureExplainability,
} from "@/lib/project-structure/structureExplainabilityModel";
import type { KnowledgeNodeReferenceView } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import type { AgentRelevance } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { normalizeAgentRelevance } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";

export type ProjectGraphNodeDto = Readonly<{
  readonly id: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string | null;
  readonly lifecycleStatus?: string;
  readonly explainability?: StructureExplainability;
  readonly knowledgeReference?: KnowledgeNodeReferenceView;
  /** Phase 7: optional agent view hints (replay / projection). */
  readonly agentRelevance?: AgentRelevance;
}>;

export type ProjectGraphEdgeDto = Readonly<{
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly edgeType: string;
}>;

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

function parseExplainability(raw: unknown): StructureExplainability | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  try {
    return toStructureExplainability(raw as never);
  } catch {
    return undefined;
  }
}

function parseKnowledgeReference(raw: unknown): KnowledgeNodeReferenceView | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const lifecycleLabel = String(r.lifecycleLabel ?? "").trim();
  const provenanceLabel = String(r.provenanceLabel ?? "").trim();
  const reusableLabel = String(r.reusableLabel ?? "").trim();
  const verificationLabel = String(r.verificationLabel ?? "").trim();
  const reusableRaw = r.reusable;
  const reusable =
    typeof reusableRaw === "boolean" ? reusableRaw : reusableLabel.includes("가능");
  if (!lifecycleLabel && !provenanceLabel) return undefined;
  return {
    lifecycleLabel: lifecycleLabel || "작성 중",
    provenanceLabel: provenanceLabel || "시스템에서 생성됨",
    reusable,
    reusableLabel: reusableLabel || (reusable ? "참조 사용 가능" : "참조 사용 불가"),
    verificationLabel: verificationLabel || "검증 대기",
  };
}

function parseNode(raw: unknown): ProjectGraphNodeDto | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const n = raw as Record<string, unknown>;
  const id = String(n.id ?? "").trim();
  if (!id) return null;
  const agentRelevanceRaw = n.agentRelevance;
  const agentRelevance =
    agentRelevanceRaw != null ? normalizeAgentRelevance(agentRelevanceRaw) : {};
  return {
    id,
    nodeType: String(n.nodeType ?? ""),
    title: String(n.title ?? ""),
    summary: n.summary == null ? null : String(n.summary),
    lifecycleStatus: n.lifecycleStatus == null ? undefined : String(n.lifecycleStatus),
    explainability: parseExplainability(n.explainability),
    knowledgeReference: parseKnowledgeReference(n.knowledgeReference),
    ...(Object.keys(agentRelevance).length > 0 ? { agentRelevance } : {}),
  };
}

function parseEdge(raw: unknown): ProjectGraphEdgeDto | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  const id = String(e.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    fromNodeId: String(e.fromNodeId ?? ""),
    toNodeId: String(e.toNodeId ?? ""),
    edgeType: String(e.edgeType ?? ""),
  };
}

export async function fetchProjectGraph(
  projectId: string,
  filters?: Readonly<{ readonly nodeType?: string; readonly edgeType?: string; readonly limit?: number }>,
): Promise<{ readonly nodes: ProjectGraphNodeDto[]; readonly edges: ProjectGraphEdgeDto[] }> {
  const pid = projectId.trim();
  if (!pid) throw new Error("projectId가 필요합니다.");

  const params = new URLSearchParams();
  if (filters?.nodeType) params.set("nodeType", filters.nodeType);
  if (filters?.edgeType) params.set("edgeType", filters.edgeType);
  if (filters?.limit != null) params.set("limit", String(filters.limit));

  const qs = params.toString();
  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/graph${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as ApiEnvelope<{ nodes?: unknown[]; edges?: unknown[] }>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? "그래프를 불러오지 못했습니다.");
  }

  const nodes = (json.data?.nodes ?? []).map(parseNode).filter((n): n is ProjectGraphNodeDto => n != null);
  const edges = (json.data?.edges ?? []).map(parseEdge).filter((e): e is ProjectGraphEdgeDto => e != null);
  return { nodes, edges };
}
