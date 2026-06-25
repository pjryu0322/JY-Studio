import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import { buildReusableAssetsFromReferenceSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceSnapshotAssets";

export type ProjectReferencePlanningContext = Readonly<{
  readonly hasReference: boolean;
  readonly referenceCount: number;
  readonly sections: ReadonlyArray<{
    readonly title: string;
    readonly content: string;
  }>;
  readonly sourceSnapshotIds: readonly string[];
}>;

function bulletLines(items: readonly string[], max = 12): string {
  const slice = items.slice(0, max);
  if (!slice.length) return "(없음)";
  return slice.map((t) => `- ${t}`).join("\n");
}

export function buildProjectReferencePlanningContext(
  snapshots: readonly KnowledgeGraphRevisionSnapshot[],
): ProjectReferencePlanningContext {
  if (!snapshots.length) {
    return { hasReference: false, referenceCount: 0, sections: [], sourceSnapshotIds: [] };
  }

  const merged = {
    actors: [] as string[],
    serviceFlows: [] as string[],
    features: [] as string[],
    decisions: [] as string[],
  };

  for (const snapshot of snapshots) {
    const assets = buildReusableAssetsFromReferenceSnapshot(snapshot);
    merged.actors.push(...assets.actors);
    merged.serviceFlows.push(...assets.serviceFlows);
    merged.features.push(...assets.features);
    merged.decisions.push(...assets.decisions);
  }

  const sections = [
    {
      title: "주요 액터",
      content: bulletLines([...new Set(merged.actors)]),
    },
    {
      title: "서비스 흐름",
      content: bulletLines([...new Set(merged.serviceFlows)]),
    },
    {
      title: "주요 기능",
      content: bulletLines([...new Set(merged.features)]),
    },
    {
      title: "결정·제약",
      content: bulletLines([...new Set(merged.decisions)]),
    },
  ];

  return {
    hasReference: true,
    referenceCount: snapshots.length,
    sections,
    sourceSnapshotIds: [],
  };
}

export function formatProjectReferencePlanningContextForPrompt(
  context: ProjectReferencePlanningContext,
): string {
  if (!context.hasReference) return "";

  const body = context.sections
    .map((s) => `## ${s.title}\n${s.content}`)
    .join("\n\n");

  return `[참조 프로젝트 정보]
이 정보는 이전 프로젝트를 복사하기 위한 것이 아니라, 새 프로젝트의 아이디어 구체화에 참고하기 위한 구조 정보입니다.

${body}

주의:
- 참조 정보는 그대로 복사하지 말고 현재 사용자의 새 프로젝트 설명에 맞게 재해석한다.
- 참조 프로젝트의 내부 ID, 대화 원문, 개인 메모는 사용하지 않는다.`;
}

export const REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE = "reference-snapshot-planning-welcome" as const;

export function buildReferencePlanningWelcomeMessageBody(
  summary: import("@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes").ProjectReferenceSelectionSummaryV1,
): string {
  return `선택한 참조 프로젝트(${summary.sourceProjectTitle} · ${summary.snapshotTitle})의 구조 정보를 불러왔습니다.
이 정보는 복사가 아니라 새 프로젝트 기획을 돕기 위한 참고 자료로만 사용됩니다.
액터, 서비스 흐름, 기능 구조를 참고하되 현재 프로젝트 설명에 맞게 다시 구체화하겠습니다.

Actor ${summary.actorCount}개 · Flow ${summary.serviceFlowCount}개 · Feature ${summary.featureCount}개 · Graph ${summary.graphReusableNodeCount}개

선택한 참조 정보는 모든 답변에 그대로 복사되지 않고, 대화 내용과 관련 있는 항목만 기획 컨텍스트로 사용됩니다.`;
}

export const REFERENCE_PLANNING_CHIP_VIEW = "참조 정보 보기";
export const REFERENCE_PLANNING_CHIP_CLEAR = "참조 해제";
export const REFERENCE_PLANNING_CHIP_CONTINUE = "계속 진행";

export const REFERENCE_PLANNING_INFO_VIEW_INTERNAL_TYPE = "reference-snapshot-planning-info-view" as const;
export const REFERENCE_PLANNING_CLEAR_NOTICE_INTERNAL_TYPE = "reference-snapshot-planning-clear-notice" as const;

export const REFERENCE_PLANNING_CLEAR_NOTICE_BODY = "참조 프로젝트 선택을 해제했습니다.";

export function buildReferenceInfoViewMessageBody(
  summary: import("@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes").ProjectReferenceSelectionSummaryV1,
): string {
  const statusLabel = summary.readiness === "VERIFIED" ? "VERIFIED" : "READY";
  return `선택된 참조 프로젝트 정보입니다.

프로젝트: ${summary.sourceProjectTitle}
저장본: ${summary.snapshotTitle}
상태: ${statusLabel}
구성: Actor ${summary.actorCount}개 · Flow ${summary.serviceFlowCount}개 · Feature ${summary.featureCount}개 · Graph ${summary.graphReusableNodeCount}개

이 정보는 복사가 아니라 새 프로젝트 기획을 위한 참고 자료로만 사용됩니다.

대화 내용과 관련 있는 항목만 기획 컨텍스트로 주입됩니다.`;
}
