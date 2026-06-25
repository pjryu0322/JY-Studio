import { prisma } from "@/lib/prisma";
import { loadKnowledgeGraphRevision } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionQuery";
import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import {
  buildProjectReferencePlanningContext,
} from "@/lib/project-knowledge/projectKnowledgeReferenceContextBuilder";
import { selectReferenceContextNodes } from "@/lib/project-knowledge/projectKnowledgeReferenceNodeSelector";
import {
  parseProjectReferenceSelectionV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ReferencePromptContextMode = "SUMMARY" | "RELEVANT_NODES" | "SUMMARY_AND_RELEVANT_NODES";

export type ReferencePromptContextNode = Readonly<{
  readonly title: string;
  readonly nodeType: string;
  readonly reusableAs: readonly string[];
  readonly reason: string;
  readonly score: number;
}>;

export type ReferencePromptContextSection = Readonly<{
  readonly hasReference: boolean;
  readonly sourceSnapshotIds: readonly string[];
  readonly mode: ReferencePromptContextMode;
  readonly summarySections: readonly {
    readonly title: string;
    readonly content: string;
  }[];
  readonly selectedNodes: readonly ReferencePromptContextNode[];
  readonly promptText: string;
  readonly diagnostics: Readonly<{
    readonly selectedNodeCount: number;
    readonly candidateNodeCount: number;
    readonly selectionQuery: string;
    readonly selectionReason: string;
  }>;
}>;

const EMPTY_SECTION: ReferencePromptContextSection = {
  hasReference: false,
  sourceSnapshotIds: [],
  mode: "SUMMARY",
  summarySections: [],
  selectedNodes: [],
  promptText: "",
  diagnostics: {
    selectedNodeCount: 0,
    candidateNodeCount: 0,
    selectionQuery: "",
    selectionReason: "reference_selection_absent",
  },
};

const PROMPT_POLICY = `이 정보는 이전 프로젝트를 복사하기 위한 것이 아니라, 새 프로젝트 기획에 참고하기 위한 구조 정보입니다.
현재 프로젝트 설명과 사용자의 최신 입력에 맞게 재해석하십시오.
내부 ID, 원문 대화, 개인 메모는 사용하지 마십시오.
참조 정보는 그대로 복사하지 말고 현재 프로젝트에 맞게 재해석합니다.`;

export function formatReferencePromptContextSectionText(input: Readonly<{
  readonly summarySections: ReferencePromptContextSection["summarySections"];
  readonly selectedNodes: readonly ReferencePromptContextNode[];
}>): string {
  const lines: string[] = ["[참조 프로젝트 컨텍스트]", PROMPT_POLICY, ""];

  if (input.selectedNodes.length) {
    lines.push("## 현재 입력과 관련 높은 참조 항목");
    for (const node of input.selectedNodes) {
      lines.push(`- [${node.nodeType}] ${node.title} — ${node.reason}`);
    }
    lines.push("");
  }

  if (input.summarySections.length) {
    lines.push("## 참조 구조 요약");
    for (const section of input.summarySections) {
      lines.push(`### ${section.title}`, section.content, "");
    }
  }

  return lines.join("\n").trim().slice(0, 6000);
}

/** Orchestration / bootstrap LLM user prompt용 section wrapper */
export function wrapReferenceContextForOrchestrationLlm(promptText: string): string {
  const body = String(promptText ?? "").trim().slice(0, 6000);
  if (!body) return "";
  return `\n[reference_context]\n${body}`;
}

export function referencePromptContextTimelineFields(
  section: ReferencePromptContextSection,
): Pick<
  RequirementsPromptTimelineEntry,
  | "referenceContextInjected"
  | "referenceContextMode"
  | "referenceContextSelectedNodeCount"
  | "referenceContextCandidateNodeCount"
  | "referenceContextSourceSnapshotCount"
  | "referenceContextSelectionReason"
> {
  if (!section.hasReference) {
    return { referenceContextInjected: false };
  }
  return {
    referenceContextInjected: true,
    referenceContextMode: section.mode,
    referenceContextSelectedNodeCount: section.diagnostics.selectedNodeCount,
    referenceContextCandidateNodeCount: section.diagnostics.candidateNodeCount,
    referenceContextSourceSnapshotCount: section.sourceSnapshotIds.length,
    referenceContextSelectionReason: section.diagnostics.selectionReason.slice(0, 200),
  };
}

async function loadSnapshotsForSelection(
  snapshotIds: readonly string[],
): Promise<KnowledgeGraphRevisionSnapshot[]> {
  const snapshots: KnowledgeGraphRevisionSnapshot[] = [];
  for (const snapshotId of snapshotIds) {
    const revision = await prisma.projectKnowledgeGraphRevision.findUnique({
      where: { id: snapshotId },
      select: { id: true, projectId: true },
    });
    if (!revision) continue;
    const detail = await loadKnowledgeGraphRevision(revision.projectId, revision.id);
    if (detail?.graphSnapshot) snapshots.push(detail.graphSnapshot);
  }
  return snapshots;
}

export async function buildReferencePromptContextForProjectTurn(input: Readonly<{
  readonly projectId: string;
  readonly userMessage?: string;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
  readonly maxNodes?: number;
}>): Promise<ReferencePromptContextSection> {
  const pid = String(input.projectId ?? "").trim();
  if (!pid) return EMPTY_SECTION;

  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson);
  const selection = parseProjectReferenceSelectionV1(state?.referenceSelectionV1);
  if (!selection?.referenceSnapshotIds.length) return EMPTY_SECTION;

  const snapshotIds = [...selection.referenceSnapshotIds];
  const graphSnapshots = await loadSnapshotsForSelection(snapshotIds);
  if (!graphSnapshots.length) return EMPTY_SECTION;

  const planning = buildProjectReferencePlanningContext(graphSnapshots);
  const summarySections = planning.sections;
  const userMessage = String(input.userMessage ?? "").trim();

  let selectedNodes: readonly ReferencePromptContextNode[] = [];
  let candidateNodeCount = 0;
  let selectionQuery = userMessage.slice(0, 500);
  let selectionReason = "summary_only";

  if (userMessage) {
    const picked = selectReferenceContextNodes({
      userMessage,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      snapshots: graphSnapshots,
      maxNodes: input.maxNodes,
    });
    selectedNodes = picked.selectedNodes;
    candidateNodeCount = picked.candidateNodeCount;
    selectionQuery = picked.selectionQuery;
    selectionReason = picked.selectionReason;
  }

  const mode: ReferencePromptContextMode =
    selectedNodes.length > 0 && summarySections.length
      ? "SUMMARY_AND_RELEVANT_NODES"
      : selectedNodes.length > 0
        ? "RELEVANT_NODES"
        : "SUMMARY";

  const promptText = formatReferencePromptContextSectionText({ summarySections, selectedNodes });

  return {
    hasReference: true,
    sourceSnapshotIds: snapshotIds,
    mode,
    summarySections,
    selectedNodes,
    promptText,
    diagnostics: {
      selectedNodeCount: selectedNodes.length,
      candidateNodeCount,
      selectionQuery,
      selectionReason,
    },
  };
}
