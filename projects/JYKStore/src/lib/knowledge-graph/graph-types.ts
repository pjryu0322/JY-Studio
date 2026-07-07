import type { Prisma } from "@prisma/client";

export type PlannedGraphNode = {
  externalId: string;
  nodeType: string;
  label: string;
  summary: string | null;
  metadata: Prisma.InputJsonValue | undefined;
};

export type PlannedGraphEdge = {
  edgeType: string;
  fromExternalId: string;
  toExternalId: string;
};

export type PlannedKnowledgeGraph = {
  nodesByExternalId: Map<string, PlannedGraphNode>;
  edges: PlannedGraphEdge[];
};

// rebuild 시 로드하는 version(원본 문서 + 활성 chunk 포함) 타입.
export type RebuildVersion = Prisma.KnowledgePackVersionGetPayload<{
  include: { sourceDocuments: true; chunks: true };
}>;
