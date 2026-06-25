import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import type { KnowledgeNodeReusableAs } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import { assessReferenceSafety } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";
import type { ReferencePromptContextNode } from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";

export type SelectReferenceContextNodesInput = Readonly<{
  readonly userMessage: string;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
  readonly snapshots: readonly KnowledgeGraphRevisionSnapshot[];
  readonly maxNodes?: number;
}>;

export type SelectReferenceContextNodesResult = Readonly<{
  readonly selectedNodes: readonly ReferencePromptContextNode[];
  readonly candidateNodeCount: number;
  readonly selectionQuery: string;
  readonly selectionReason: string;
}>;

const REUSABLE_AS_WEIGHT: Partial<Record<KnowledgeNodeReusableAs, number>> = {
  ACTOR: 1.2,
  SERVICE_FLOW: 1.15,
  FEATURE: 1.1,
  DECISION: 1.05,
  CONSTRAINT: 1.05,
};

const CATEGORY_CAPS: Readonly<Record<string, number>> = {
  Actor: 2,
  ServiceFlow: 3,
  Feature: 3,
  Decision: 2,
  Constraint: 2,
  Other: 2,
};

function normalizeMatchText(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeForMatch(text: string): string[] {
  const normalized = normalizeMatchText(text);
  if (!normalized) return [];
  const parts = normalized.split(/[\s,./|·\-—]+/).filter(Boolean);
  const tokens = new Set<string>(parts);
  for (const part of parts) {
    if (part.length >= 2) tokens.add(part);
  }
  return [...tokens];
}

function nodeCategory(nodeType: string, reusableAs: readonly string[]): string {
  const t = nodeType.trim();
  if (t === "Actor" || reusableAs.includes("ACTOR")) return "Actor";
  if (t === "ServiceFlow" || reusableAs.includes("SERVICE_FLOW")) return "ServiceFlow";
  if (t === "Feature" || reusableAs.includes("FEATURE")) return "Feature";
  if (reusableAs.includes("DECISION")) return "Decision";
  if (reusableAs.includes("CONSTRAINT")) return "Constraint";
  return "Other";
}

function isEligibleSnapshotNode(node: KnowledgeGraphRevisionSnapshot["nodes"][number]): boolean {
  const ref = node.reference;
  if (!ref?.reusable || !ref.safeForReference) return false;
  const title = String(node.title ?? "").trim();
  if (!title) return false;
  if (!assessReferenceSafety({ title, summary: node.summary }).safeForReference) return false;
  return true;
}

function scoreNode(input: Readonly<{
  title: string;
  summary: string | null;
  reusableAs: readonly string[];
  userTokens: readonly string[];
  projectTokens: readonly string[];
  userBlob: string;
}>): number {
  const titleNorm = normalizeMatchText(input.title);
  const summaryNorm = normalizeMatchText(input.summary ?? "");
  let score = 0;

  for (const token of input.userTokens) {
    if (token.length < 2) continue;
    if (titleNorm.includes(token)) score += 4;
    if (summaryNorm.includes(token)) score += 2;
  }

  for (const token of input.projectTokens) {
    if (token.length < 2) continue;
    if (titleNorm.includes(token)) score += 1.5;
    if (summaryNorm.includes(token)) score += 0.75;
  }

  if (input.userBlob && titleNorm && input.userBlob.includes(titleNorm)) score += 5;

  for (const ra of input.reusableAs) {
    const w = REUSABLE_AS_WEIGHT[ra as KnowledgeNodeReusableAs];
    if (w) score += w;
  }

  return score;
}

function buildSelectionReason(title: string, userMessage: string): string {
  const msg = normalizeMatchText(userMessage);
  const t = normalizeMatchText(title);
  if (t && msg.includes(t)) return `사용자 입력의 "${title}" 표현과 관련됨`;
  return "사용자 입력·프로젝트 설명과 키워드가 겹침";
}

export function selectMaterializedReferenceContextNodes(input: Readonly<{
  readonly userMessage: string;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
  readonly materializedContext: import("@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext").MaterializedReferenceContextV1;
  readonly maxNodes?: number;
}>): SelectReferenceContextNodesResult {
  const maxNodes = Math.min(12, Math.max(1, input.maxNodes ?? 8));
  const userMessage = String(input.userMessage ?? "").trim();
  const selectionQuery = userMessage.slice(0, 500);
  if (!userMessage) {
    return {
      selectedNodes: [],
      candidateNodeCount: 0,
      selectionQuery,
      selectionReason: "사용자 입력 없음",
    };
  }
  const userBlob = normalizeMatchText(userMessage);
  const userTokens = tokenizeForMatch(userMessage);
  const projectTokens = tokenizeForMatch(
    `${input.projectName ?? ""} ${input.projectDescription ?? ""}`,
  );

  const scored: Array<ReferencePromptContextNode & { category: string; sortScore: number }> = [];

  for (const node of input.materializedContext.nodes) {
    const title = String(node.title ?? "").trim();
    if (!title) continue;
    if (!assessReferenceSafety({ title, summary: node.summary ?? null }).safeForReference) continue;
    const reusableAs = [...node.reusableAs];
    if (!reusableAs.length) continue;

    const sortScore = scoreNode({
      title,
      summary: node.summary ?? null,
      reusableAs,
      userTokens,
      projectTokens,
      userBlob,
    });
    if (sortScore <= 0) continue;

    const category = nodeCategory(node.nodeType, reusableAs);
    scored.push({
      title: title.slice(0, 120),
      nodeType: String(node.nodeType ?? "").trim().slice(0, 40) || category,
      reusableAs,
      reason: buildSelectionReason(title, userMessage || input.projectDescription || ""),
      score: Math.round(sortScore * 100) / 100,
      category,
      sortScore,
    });
  }

  const candidateNodeCount = scored.length;
  if (!candidateNodeCount) {
    return {
      selectedNodes: [],
      candidateNodeCount: 0,
      selectionQuery,
      selectionReason: "관련 키워드와 매칭되는 안전한 노드 없음",
    };
  }

  scored.sort((a, b) => b.sortScore - a.sortScore);

  const categoryCounts: Record<string, number> = {};
  const selected: ReferencePromptContextNode[] = [];

  for (const row of scored) {
    if (selected.length >= maxNodes) break;
    const cap = CATEGORY_CAPS[row.category] ?? CATEGORY_CAPS.Other;
    const used = categoryCounts[row.category] ?? 0;
    if (used >= cap) continue;
    categoryCounts[row.category] = used + 1;
    selected.push({
      title: row.title,
      nodeType: row.nodeType,
      reusableAs: row.reusableAs,
      reason: row.reason,
      score: row.score,
    });
  }

  return {
    selectedNodes: selected,
    candidateNodeCount,
    selectionQuery,
    selectionReason:
      selected.length > 0
        ? `키워드 매칭 상위 ${selected.length}개 노드 선택`
        : "카테고리 상한으로 선택 가능한 노드 없음",
  };
}

export function selectReferenceContextNodes(
  input: SelectReferenceContextNodesInput,
): SelectReferenceContextNodesResult {
  const maxNodes = Math.min(12, Math.max(1, input.maxNodes ?? 8));
  const userMessage = String(input.userMessage ?? "").trim();
  const selectionQuery = userMessage.slice(0, 500);
  if (!userMessage) {
    return {
      selectedNodes: [],
      candidateNodeCount: 0,
      selectionQuery,
      selectionReason: "사용자 입력 없음",
    };
  }
  const userBlob = normalizeMatchText(userMessage);
  const userTokens = tokenizeForMatch(userMessage);
  const projectTokens = tokenizeForMatch(
    `${input.projectName ?? ""} ${input.projectDescription ?? ""}`,
  );

  const scored: Array<ReferencePromptContextNode & { category: string; sortScore: number }> = [];

  for (const snapshot of input.snapshots) {
    for (const node of snapshot.nodes) {
      if (!isEligibleSnapshotNode(node)) continue;
      const reusableAs = [...(node.reference?.reusableAs ?? [])].map(String);
      const sortScore = scoreNode({
        title: node.title,
        summary: node.summary,
        reusableAs,
        userTokens,
        projectTokens,
        userBlob,
      });
      if (sortScore <= 0 && userMessage) continue;

      const category = nodeCategory(node.nodeType, reusableAs);
      scored.push({
        title: node.title.trim().slice(0, 120),
        nodeType: node.nodeType.trim().slice(0, 40) || category,
        reusableAs,
        reason: buildSelectionReason(node.title, userMessage || input.projectDescription || ""),
        score: Math.round(sortScore * 100) / 100,
        category,
        sortScore,
      });
    }
  }

  const candidateNodeCount = scored.length;
  if (!candidateNodeCount) {
    return {
      selectedNodes: [],
      candidateNodeCount: 0,
      selectionQuery,
      selectionReason: userMessage ? "관련 키워드와 매칭되는 안전한 노드 없음" : "사용자 입력 없음",
    };
  }

  scored.sort((a, b) => b.sortScore - a.sortScore);

  const categoryCounts: Record<string, number> = {};
  const selected: ReferencePromptContextNode[] = [];

  for (const row of scored) {
    if (selected.length >= maxNodes) break;
    const cap = CATEGORY_CAPS[row.category] ?? CATEGORY_CAPS.Other;
    const used = categoryCounts[row.category] ?? 0;
    if (used >= cap) continue;
    categoryCounts[row.category] = used + 1;
    selected.push({
      title: row.title,
      nodeType: row.nodeType,
      reusableAs: row.reusableAs,
      reason: row.reason,
      score: row.score,
    });
  }

  return {
    selectedNodes: selected,
    candidateNodeCount,
    selectionQuery,
    selectionReason:
      selected.length > 0
        ? `키워드 매칭 상위 ${selected.length}개 노드 선택`
        : "카테고리 상한으로 선택 가능한 노드 없음",
  };
}
