import type { ReferencePackageCandidate } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";

export type ReferenceLibrarySnapshotPurpose = "REFERENCE_CANDIDATE" | "REFERENCE_PACKAGE";

export type ReferenceLibraryReadiness = "READY" | "VERIFIED";

export type ReferenceLibraryItem = Readonly<{
  readonly projectId: string;
  readonly projectTitle: string;
  readonly projectDescription?: string | null;
  readonly referenceSnapshotId: string;
  readonly snapshotTitle: string;
  readonly snapshotPurpose: ReferenceLibrarySnapshotPurpose;
  readonly createdAt: string;
  readonly updatedAt?: string | null;
  readonly readiness: ReferenceLibraryReadiness;
  readonly reusableAssets: ReferencePackageCandidate["reusableAssets"];
  readonly counts: Readonly<{
    readonly actors: number;
    readonly serviceFlows: number;
    readonly features: number;
    readonly reusableGraphNodes: number;
  }>;
}>;

export type ProjectReferenceSelectionV1 = Readonly<{
  readonly referenceSnapshotIds: readonly string[];
  readonly selectedAt: string;
  readonly source: "USER_SELECTED";
}>;

export type ProjectReferenceSelectionSummaryV1 = Readonly<{
  readonly sourceProjectTitle: string;
  readonly snapshotTitle: string;
  readonly readiness: ReferenceLibraryReadiness;
  readonly actorCount: number;
  readonly serviceFlowCount: number;
  readonly featureCount: number;
  readonly graphReusableNodeCount: number;
}>;

export function parseProjectReferenceSelectionV1(raw: unknown): ProjectReferenceSelectionV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const ids = Array.isArray(o.referenceSnapshotIds)
    ? o.referenceSnapshotIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  if (!ids.length) return null;
  const selectedAt = String(o.selectedAt ?? "").trim();
  if (!selectedAt) return null;
  if (o.source !== "USER_SELECTED") return null;
  return { referenceSnapshotIds: ids, selectedAt, source: "USER_SELECTED" };
}

export function parseProjectReferenceSelectionSummaryV1(raw: unknown): ProjectReferenceSelectionSummaryV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const sourceProjectTitle = String(o.sourceProjectTitle ?? "").trim();
  const snapshotTitle = String(o.snapshotTitle ?? "").trim();
  const readiness = o.readiness === "VERIFIED" ? "VERIFIED" : o.readiness === "READY" ? "READY" : null;
  if (!sourceProjectTitle || !snapshotTitle || !readiness) return null;
  return {
    sourceProjectTitle,
    snapshotTitle,
    readiness,
    actorCount: Number(o.actorCount) || 0,
    serviceFlowCount: Number(o.serviceFlowCount) || 0,
    featureCount: Number(o.featureCount) || 0,
    graphReusableNodeCount: Number(o.graphReusableNodeCount) || 0,
  };
}
