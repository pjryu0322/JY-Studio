import { getProjectGraphSnapshotWithExplainability } from "@/lib/project-graph/projectGraphSnapshotEnrich";
import { listKnowledgeGraphRevisions, loadKnowledgeGraphRevision } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";
import { parseKnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";
import { normalizeGraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import {
  computeReferenceEligibility,
  type ReferenceEligibilityNodeMetrics,
} from "@/lib/project-knowledge/projectKnowledgeReferenceEligibilityService";
import { toReferenceEligibilityNodeInput } from "@/lib/project-knowledge/projectKnowledgeReferenceNodeMeta";
import type {
  ReferenceEligibility,
  ReferencePackageCandidate,
} from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import type { KnowledgeGraphRevisionListItem } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import { isTextSafeForReferencePackage } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

function revisionHasReferenceSnapshotPurpose(
  revision: KnowledgeGraphRevisionListItem,
  snap: ReturnType<typeof parseKnowledgeGraphRevisionSnapshot>,
): boolean {
  const purpose = normalizeGraphSnapshotPurpose(snap.purpose);
  if (purpose === "REFERENCE_CANDIDATE" || purpose === "REFERENCE_PACKAGE") {
    return true;
  }
  const title = String(revision.title ?? "").trim();
  return title === "그래프 반영" || title === "추천안 승인";
}

async function loadLatestReferenceSnapshotFlag(projectId: string): Promise<boolean> {
  const revisions = await listKnowledgeGraphRevisions(projectId, { limit: 50 });
  const latest = revisions[revisions.length - 1];
  if (!latest) return false;
  const detail = await loadKnowledgeGraphRevision(projectId, latest.id);
  if (!detail) return false;
  const snap = parseKnowledgeGraphRevisionSnapshot(detail.graphSnapshot);
  return revisionHasReferenceSnapshotPurpose(latest, snap);
}

export async function getProjectReferenceEligibility(projectId: string): Promise<ReferenceEligibility> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return computeReferenceEligibility([], { hasReferenceCandidateSnapshot: false });
  }

  const graph = await getProjectGraphSnapshotWithExplainability(pid, { limit: 500 });
  const metrics: ReferenceEligibilityNodeMetrics[] = graph.nodes.map((n) => {
    const mapped = toReferenceEligibilityNodeInput({
      nodeType: n.nodeType,
      title: n.title,
      summary: n.summary,
      lifecycleStatus: (n as { lifecycleStatus?: string }).lifecycleStatus,
      projectionKey: n.projectionKey,
      explainability: (n as { explainability?: never }).explainability,
    });
    return {
      lifecycle: mapped.lifecycle,
      nodeType: mapped.nodeType,
      reusable: mapped.reusable,
      safeForReference: mapped.safeForReference,
    };
  });

  const hasReferenceCandidateSnapshot = await loadLatestReferenceSnapshotFlag(pid);

  return computeReferenceEligibility(metrics, { hasReferenceCandidateSnapshot });
}

export async function buildReferencePackageCandidate(projectId: string): Promise<ReferencePackageCandidate> {
  const pid = String(projectId ?? "").trim();
  const eligibility = await getProjectReferenceEligibility(pid);
  const exclusions: string[] = [];
  const blockingIssues = [...eligibility.blockingIssues];

  const graph = await getProjectGraphSnapshotWithExplainability(pid, { limit: 500 });
  const actors: string[] = [];
  const serviceFlows: string[] = [];
  const features: string[] = [];
  const decisions: string[] = [];

  for (const n of graph.nodes) {
    const mapped = toReferenceEligibilityNodeInput({
      nodeType: n.nodeType,
      title: n.title,
      summary: n.summary,
      lifecycleStatus: (n as { lifecycleStatus?: string }).lifecycleStatus,
      projectionKey: n.projectionKey,
      explainability: (n as { explainability?: never }).explainability,
    });
    if (!mapped.reusable || !mapped.safeForReference) {
      exclusions.push("미승인 또는 참조 제외 항목이 정리되었습니다.");
      continue;
    }
    const label = n.title.trim();
    if (!isTextSafeForReferencePackage(label)) continue;
    if (/actor/i.test(n.nodeType)) actors.push(label);
    else if (/flow/i.test(n.nodeType)) serviceFlows.push(label);
    else if (/feature/i.test(n.nodeType)) features.push(label);
    else if (/decision/i.test(n.nodeType)) decisions.push(label);
  }

  const unique = (items: string[]) => [...new Set(items)].slice(0, 20);
  const readiness =
    eligibility.level === "VERIFIED"
      ? "VERIFIED"
      : eligibility.level === "READY"
        ? "READY"
        : eligibility.level === "PARTIAL"
          ? "PARTIAL"
          : "NOT_READY";

  const revisions = await listKnowledgeGraphRevisions(pid, { limit: 50 });
  const latest = revisions[revisions.length - 1];

  return {
    projectId: pid,
    ...(latest ? { sourceRevisionId: latest.id } : {}),
    readiness,
    summary:
      readiness === "READY" || readiness === "VERIFIED"
        ? "승인된 구조 요약을 참조 패키지 후보로 정리했습니다."
        : "참조 패키지 후보로 사용하기에 구조가 아직 부족합니다.",
    reusableAssets: {
      actors: unique(actors),
      serviceFlows: unique(serviceFlows),
      features: unique(features),
      graphSummary: `항목 ${eligibility.counts.reusableGraphNodes}개 · 연결 가능 구조`,
      decisions: unique(decisions),
    },
    exclusions: [...new Set(exclusions)].slice(0, 8),
    blockingIssues,
  };
}
