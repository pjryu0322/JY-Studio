import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import type { KnowledgeNodeReusableAs } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import { normalizeGraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import { assessReferenceSafety } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

export type MaterializedReferenceContextV1 = Readonly<{
  readonly version: 1;
  readonly materializedAt: string;
  readonly source: Readonly<{
    readonly sourceProjectTitle: string;
    readonly snapshotTitle: string;
    readonly snapshotPurpose: "REFERENCE_CANDIDATE" | "REFERENCE_PACKAGE";
    readonly sourceSnapshotId?: string;
  }>;
  readonly policy: Readonly<{
    readonly usage: "REFERENCE_ONLY";
    readonly copyProhibited: true;
    readonly reinterpretForCurrentProject: true;
    readonly excludesRawConversation: true;
    readonly excludesPersonalMemo: true;
    readonly excludesInternalIds: true;
  }>;
  readonly summary: Readonly<{
    readonly actorCount: number;
    readonly serviceFlowCount: number;
    readonly featureCount: number;
    readonly decisionCount: number;
    readonly constraintCount: number;
    readonly graphReusableNodeCount: number;
  }>;
  readonly nodes: ReadonlyArray<{
    readonly title: string;
    readonly nodeType: string;
    readonly reusableAs: readonly string[];
    readonly summary?: string | null;
  }>;
  readonly sections: ReadonlyArray<{
    readonly title: string;
    readonly content: string;
  }>;
}>;

const MAX_NODES = 80;
const MAX_SECTIONS = 8;
const MAX_TITLE = 120;
const MAX_SUMMARY = 500;
const MAX_SECTION_CONTENT = 2000;

const FIXED_POLICY: MaterializedReferenceContextV1["policy"] = {
  usage: "REFERENCE_ONLY",
  copyProhibited: true,
  reinterpretForCurrentProject: true,
  excludesRawConversation: true,
  excludesPersonalMemo: true,
  excludesInternalIds: true,
};

function fallbackReusableAs(nodeType: string): readonly KnowledgeNodeReusableAs[] {
  const t = nodeType.trim();
  if (/actor/i.test(t)) return ["ACTOR"];
  if (/flow/i.test(t)) return ["SERVICE_FLOW"];
  if (/feature/i.test(t)) return ["FEATURE"];
  if (/decision/i.test(t)) return ["DECISION"];
  if (/constraint/i.test(t)) return ["CONSTRAINT"];
  return [];
}

function bulletLines(items: readonly string[], max = 12): string {
  const slice = items.slice(0, max);
  if (!slice.length) return "(없음)";
  return slice.map((t) => `- ${t}`).join("\n");
}

export function sanitizeMaterializedReferenceNode(input: Readonly<{
  readonly title: string;
  readonly nodeType: string;
  readonly reusableAs: readonly string[];
  readonly summary?: string | null;
}>): MaterializedReferenceContextV1["nodes"][number] | null {
  const title = String(input.title ?? "").trim().slice(0, MAX_TITLE);
  const nodeType = String(input.nodeType ?? "").trim().slice(0, 40);
  const summaryRaw = input.summary == null ? null : String(input.summary).trim().slice(0, MAX_SUMMARY);
  const reusableAs = [...new Set(input.reusableAs.map((x) => String(x ?? "").trim()).filter(Boolean))].slice(0, 8);
  if (!title || !reusableAs.length) return null;
  if (!assessReferenceSafety({ title, summary: summaryRaw }).safeForReference) return null;
  return {
    title,
    nodeType: nodeType || "Node",
    reusableAs,
    ...(summaryRaw ? { summary: summaryRaw } : {}),
  };
}

export function formatMaterializedReferenceSummarySections(
  nodes: readonly MaterializedReferenceContextV1["nodes"][number][],
): MaterializedReferenceContextV1["sections"] {
  const actors: string[] = [];
  const flows: string[] = [];
  const features: string[] = [];
  const decisions: string[] = [];
  const constraints: string[] = [];

  for (const node of nodes) {
    const as = node.reusableAs;
    if (as.includes("ACTOR")) actors.push(node.title);
    if (as.includes("SERVICE_FLOW")) flows.push(node.title);
    if (as.includes("FEATURE")) features.push(node.title);
    if (as.includes("DECISION")) decisions.push(node.title);
    if (as.includes("CONSTRAINT")) constraints.push(node.title);
  }

  const sections = [
    { title: "주요 액터", content: bulletLines([...new Set(actors)]) },
    { title: "서비스 흐름", content: bulletLines([...new Set(flows)]) },
    { title: "주요 기능", content: bulletLines([...new Set(features)]) },
    {
      title: "결정·제약",
      content: bulletLines([...new Set([...decisions, ...constraints])]),
    },
  ];

  return sections
    .map((s) => ({
      title: s.title.slice(0, 80),
      content: s.content.slice(0, MAX_SECTION_CONTENT),
    }))
    .slice(0, MAX_SECTIONS);
}

function countByReusableAs(nodes: readonly MaterializedReferenceContextV1["nodes"][number][]) {
  let actorCount = 0;
  let serviceFlowCount = 0;
  let featureCount = 0;
  let decisionCount = 0;
  let constraintCount = 0;
  for (const node of nodes) {
    if (node.reusableAs.includes("ACTOR")) actorCount += 1;
    if (node.reusableAs.includes("SERVICE_FLOW")) serviceFlowCount += 1;
    if (node.reusableAs.includes("FEATURE")) featureCount += 1;
    if (node.reusableAs.includes("DECISION")) decisionCount += 1;
    if (node.reusableAs.includes("CONSTRAINT")) constraintCount += 1;
  }
  return { actorCount, serviceFlowCount, featureCount, decisionCount, constraintCount };
}

/**
 * Source project(A) Graph Snapshot에서 안전한 reusable 정보만 추출해
 * target project(B)에 저장할 Materialized Reference Context를 만든다.
 * 반환값은 snapshot 입력과 분리된 복사본이며, A의 이후 변경은 B에 자동 반영되지 않는다.
 */
export function buildMaterializedReferenceContextFromSnapshot(input: Readonly<{
  readonly sourceProjectTitle: string;
  readonly snapshotTitle: string;
  readonly snapshotPurpose: "REFERENCE_CANDIDATE" | "REFERENCE_PACKAGE";
  readonly sourceSnapshotId?: string;
  readonly graphSnapshot: KnowledgeGraphRevisionSnapshot;
  readonly materializedAt?: string;
}>): MaterializedReferenceContextV1 {
  const nodes: MaterializedReferenceContextV1["nodes"][number][] = [];

  for (const node of input.graphSnapshot.nodes) {
    const ref = node.reference;
    if (!ref?.reusable || !ref.safeForReference) continue;
    const reusableAs =
      ref.reusableAs.length > 0 ? [...ref.reusableAs].map(String) : [...fallbackReusableAs(node.nodeType)];
    const sanitized = sanitizeMaterializedReferenceNode({
      title: node.title,
      nodeType: node.nodeType,
      reusableAs,
      summary: node.summary,
    });
    if (sanitized) nodes.push(sanitized);
    if (nodes.length >= MAX_NODES) break;
  }

  const counts = countByReusableAs(nodes);
  const sections = formatMaterializedReferenceSummarySections(nodes);
  const purpose = normalizeGraphSnapshotPurpose(input.snapshotPurpose);
  const snapshotPurpose =
    purpose === "REFERENCE_PACKAGE" ? "REFERENCE_PACKAGE" : "REFERENCE_CANDIDATE";

  const sourceSnapshotId = String(input.sourceSnapshotId ?? "").trim() || undefined;

  return {
    version: 1,
    materializedAt: input.materializedAt ?? new Date().toISOString(),
    source: {
      sourceProjectTitle: String(input.sourceProjectTitle ?? "").trim().slice(0, 200),
      snapshotTitle: String(input.snapshotTitle ?? "").trim().slice(0, 200),
      snapshotPurpose,
      ...(sourceSnapshotId ? { sourceSnapshotId } : {}),
    },
    policy: FIXED_POLICY,
    summary: {
      ...counts,
      graphReusableNodeCount: nodes.length,
    },
    nodes,
    sections,
  };
}

export function parseMaterializedReferenceContextV1(raw: unknown): MaterializedReferenceContextV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (Number(o.version) !== 1) return null;
  const materializedAt = String(o.materializedAt ?? "").trim();
  if (!materializedAt) return null;

  const sourceRaw = o.source;
  if (!sourceRaw || typeof sourceRaw !== "object" || Array.isArray(sourceRaw)) return null;
  const s = sourceRaw as Record<string, unknown>;
  const sourceProjectTitle = String(s.sourceProjectTitle ?? "").trim().slice(0, 200);
  const snapshotTitle = String(s.snapshotTitle ?? "").trim().slice(0, 200);
  const purposeRaw = String(s.snapshotPurpose ?? "").trim();
  const snapshotPurpose =
    purposeRaw === "REFERENCE_PACKAGE" ? "REFERENCE_PACKAGE" : purposeRaw === "REFERENCE_CANDIDATE" ? "REFERENCE_CANDIDATE" : null;
  if (!sourceProjectTitle || !snapshotTitle || !snapshotPurpose) return null;
  const sourceSnapshotId = String(s.sourceSnapshotId ?? "").trim().slice(0, 64) || undefined;

  const nodesRaw = Array.isArray(o.nodes) ? o.nodes : [];
  const nodes: MaterializedReferenceContextV1["nodes"][number][] = [];
  for (const row of nodesRaw) {
    if (!row || typeof row !== "object") continue;
    const n = row as Record<string, unknown>;
    const sanitized = sanitizeMaterializedReferenceNode({
      title: String(n.title ?? ""),
      nodeType: String(n.nodeType ?? ""),
      reusableAs: Array.isArray(n.reusableAs) ? n.reusableAs.map((x) => String(x ?? "")) : [],
      summary: n.summary == null ? null : String(n.summary ?? ""),
    });
    if (sanitized) nodes.push(sanitized);
    if (nodes.length >= MAX_NODES) break;
  }

  const sectionsRaw = Array.isArray(o.sections) ? o.sections : [];
  const sections: MaterializedReferenceContextV1["sections"][number][] = [];
  for (const row of sectionsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title ?? "").trim().slice(0, 80);
    const content = String(r.content ?? "").trim().slice(0, MAX_SECTION_CONTENT);
    if (!title) continue;
    sections.push({ title, content });
    if (sections.length >= MAX_SECTIONS) break;
  }

  const summaryRaw = o.summary;
  if (!summaryRaw || typeof summaryRaw !== "object" || Array.isArray(summaryRaw)) return null;
  const sum = summaryRaw as Record<string, unknown>;
  const parsedCounts = countByReusableAs(nodes);

  return {
    version: 1,
    materializedAt,
    source: {
      sourceProjectTitle,
      snapshotTitle,
      snapshotPurpose,
      ...(sourceSnapshotId ? { sourceSnapshotId } : {}),
    },
    policy: FIXED_POLICY,
    summary: {
      actorCount: Number(sum.actorCount) || parsedCounts.actorCount,
      serviceFlowCount: Number(sum.serviceFlowCount) || parsedCounts.serviceFlowCount,
      featureCount: Number(sum.featureCount) || parsedCounts.featureCount,
      decisionCount: Number(sum.decisionCount) || parsedCounts.decisionCount,
      constraintCount: Number(sum.constraintCount) || parsedCounts.constraintCount,
      graphReusableNodeCount: nodes.length,
    },
    nodes,
    sections: sections.length ? sections : formatMaterializedReferenceSummarySections(nodes),
  };
}
