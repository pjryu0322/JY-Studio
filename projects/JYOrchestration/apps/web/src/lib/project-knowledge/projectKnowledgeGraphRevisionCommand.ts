import { prisma } from "@/lib/prisma";
import { graphSnapshotPurposeFromMilestone } from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import {
  captureKnowledgeGraphRevisionSnapshot,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";
import { toKnowledgeGraphRevisionListItem } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionQuery";
import type {
  KnowledgeGraphRevisionListItem,
  KnowledgeGraphRevisionMilestone,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

const MILESTONE_COPY: Record<
  KnowledgeGraphRevisionMilestone,
  Readonly<{ title: string; summary: string }>
> = {
  conversation_sync: { title: "대화 저장", summary: "요구사항 대화가 프로젝트 기록에 반영되었습니다." },
  snapshot_integration: { title: "스냅샷 통합", summary: "초기 기획 스냅샷이 프로젝트 기록에 통합되었습니다." },
  proposal_approval: { title: "추천안 승인", summary: "AI 추천안이 승인되어 기록에 반영되었습니다." },
  graph_projection: { title: "그래프 반영", summary: "지식 그래프에 최신 구조가 반영되었습니다." },
};

export type CreateKnowledgeGraphRevisionInput = Readonly<{
  readonly projectId: string;
  readonly milestone: KnowledgeGraphRevisionMilestone;
  readonly sourceEventId?: string | null;
  readonly titleOverride?: string | null;
  readonly summaryOverride?: string | null;
}>;

export async function createKnowledgeGraphRevision(
  input: CreateKnowledgeGraphRevisionInput,
): Promise<KnowledgeGraphRevisionListItem | null> {
  const projectId = String(input.projectId ?? "").trim();
  if (!projectId) return null;

  const copy = MILESTONE_COPY[input.milestone];
  const title = String(input.titleOverride ?? copy.title).trim() || copy.title;
  const summary = String(input.summaryOverride ?? copy.summary).trim() || copy.summary;

  const purpose = graphSnapshotPurposeFromMilestone(input.milestone);
  const snapshot = await captureKnowledgeGraphRevisionSnapshot(projectId, purpose);
  const nodeCount = snapshot.nodes.length;
  const edgeCount = snapshot.edges.length;

  const last = await prisma.projectKnowledgeGraphRevision.findFirst({
    where: { projectId },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });
  const revisionNumber = (last?.revisionNumber ?? 0) + 1;

  const sourceEventId = input.sourceEventId?.trim() || null;

  const created = await prisma.projectKnowledgeGraphRevision.create({
    data: {
      projectId,
      revisionNumber,
      sourceEventId,
      title,
      summary,
      graphSnapshot: snapshot as object,
      snapshotPurpose: purpose,
      nodeCount,
      edgeCount,
    },
  });

  return toKnowledgeGraphRevisionListItem(created);
}

export async function recordKnowledgeGraphRevisionForMilestone(
  input: CreateKnowledgeGraphRevisionInput,
): Promise<void> {
  try {
    await createKnowledgeGraphRevision(input);
  } catch (error) {
    console.error("Knowledge graph revision capture failed:", input.milestone, error);
  }
}
