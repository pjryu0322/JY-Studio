import type { GraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";

export type KnowledgeGraphRevisionSnapshotNode = Readonly<{
  readonly entityKey: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string | null;
  readonly lifecycleStatus?: string;
}>;

export type KnowledgeGraphRevisionSnapshotEdge = Readonly<{
  readonly fromEntityKey: string;
  readonly toEntityKey: string;
  readonly edgeType: string;
}>;

export type KnowledgeGraphRevisionSnapshot = Readonly<{
  readonly purpose?: GraphSnapshotPurpose;
  readonly nodes: readonly KnowledgeGraphRevisionSnapshotNode[];
  readonly edges: readonly KnowledgeGraphRevisionSnapshotEdge[];
}>;

export type KnowledgeGraphRevisionListItem = Readonly<{
  readonly id: string;
  readonly revisionNumber: number;
  readonly title: string;
  readonly summary: string | null;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly createdAt: string;
}>;

export type KnowledgeGraphRevisionDetail = KnowledgeGraphRevisionListItem &
  Readonly<{
    readonly graphSnapshot: KnowledgeGraphRevisionSnapshot;
  }>;

export type KnowledgeGraphRevisionDiffSummary = Readonly<{
  readonly addedNodeCount: number;
  readonly removedNodeCount: number;
  readonly addedEdgeCount: number;
  readonly removedEdgeCount: number;
  readonly lines: readonly string[];
}>;

export type KnowledgeGraphRevisionMilestone =
  | "conversation_sync"
  | "snapshot_integration"
  | "proposal_approval"
  | "graph_projection";
