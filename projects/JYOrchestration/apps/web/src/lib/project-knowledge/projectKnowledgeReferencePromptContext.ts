import { prisma } from "@/lib/prisma";
import type { MaterializedReferenceContextV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import { parseMaterializedReferenceContextV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import { selectMaterializedReferenceContextNodes } from "@/lib/project-knowledge/projectKnowledgeReferenceNodeSelector";
import { parseProjectReferenceSelectionV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ReferencePromptContextMode = "SUMMARY" | "RELEVANT_NODES" | "SUMMARY_AND_RELEVANT_NODES";
export type ReferencePromptContextSource = "MATERIALIZED" | "NONE" | "LEGACY_MISSING";

export type ReferencePromptContextNode = Readonly<{
  readonly title: string;
  readonly nodeType: string;
  readonly reusableAs: readonly string[];
  readonly reason: string;
  readonly score: number;
}>;

export type ReferencePromptContextSection = Readonly<{
  readonly hasReference: boolean;
  readonly referenceContextSource: ReferencePromptContextSource;
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
  referenceContextSource: "NONE",
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
  | "referenceContextSource"
> {
  if (!section.hasReference) {
    return {
      referenceContextInjected: false,
      referenceContextSource: section.referenceContextSource,
      ...(section.referenceContextSource === "LEGACY_MISSING"
        ? { referenceContextSelectionReason: section.diagnostics.selectionReason }
        : {}),
    };
  }
  return {
    referenceContextInjected: true,
    referenceContextMode: section.mode,
    referenceContextSelectedNodeCount: section.diagnostics.selectedNodeCount,
    referenceContextCandidateNodeCount: section.diagnostics.candidateNodeCount,
    referenceContextSourceSnapshotCount: section.sourceSnapshotIds.length ? 1 : 0,
    referenceContextSelectionReason: section.diagnostics.selectionReason.slice(0, 200),
    referenceContextSource: section.referenceContextSource,
  };
}

export function buildReferencePromptContextSectionFromMaterialized(input: Readonly<{
  readonly materialized: MaterializedReferenceContextV1;
  readonly userMessage?: string;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
  readonly maxNodes?: number;
}>): ReferencePromptContextSection {
  const summarySections = input.materialized.sections;
  const userMessage = String(input.userMessage ?? "").trim();

  let selectedNodes: readonly ReferencePromptContextNode[] = [];
  let candidateNodeCount = 0;
  let selectionQuery = userMessage.slice(0, 500);
  let selectionReason = "summary_only";

  if (userMessage) {
    const picked = selectMaterializedReferenceContextNodes({
      userMessage,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      materializedContext: input.materialized,
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
    referenceContextSource: "MATERIALIZED",
    sourceSnapshotIds: [],
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

export async function buildReferencePromptContextForProjectTurn(input: Readonly<{
  readonly projectId: string;
  readonly userMessage?: string;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
  readonly maxNodes?: number;
  /** 테스트·오프라인: state를 직접 주입하면 DB 조회를 생략한다 */
  readonly requirementsStateJson?: unknown;
}>): Promise<ReferencePromptContextSection> {
  const pid = String(input.projectId ?? "").trim();
  if (!pid && input.requirementsStateJson === undefined) return EMPTY_SECTION;

  let state = input.requirementsStateJson !== undefined
    ? parseRequirementsStateJson(input.requirementsStateJson)
    : null;

  if (state === null && pid) {
    const row = await prisma.project.findUnique({
      where: { id: pid },
      select: { requirementsStateJson: true },
    });
    state = parseRequirementsStateJson(row?.requirementsStateJson);
  }

  const materialized =
    parseMaterializedReferenceContextV1(state?.materializedReferenceContextV1) ??
    null;

  if (!materialized) {
    const hasLegacySelection = Boolean(parseProjectReferenceSelectionV1(state?.referenceSelectionV1));
    if (hasLegacySelection) {
      return {
        ...EMPTY_SECTION,
        referenceContextSource: "LEGACY_MISSING",
        diagnostics: {
          selectedNodeCount: 0,
          candidateNodeCount: 0,
          selectionQuery: "",
          selectionReason: "materialized_context_missing",
        },
      };
    }
    return EMPTY_SECTION;
  }

  return buildReferencePromptContextSectionFromMaterialized({
    materialized,
    userMessage: input.userMessage,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    maxNodes: input.maxNodes,
  });
}
