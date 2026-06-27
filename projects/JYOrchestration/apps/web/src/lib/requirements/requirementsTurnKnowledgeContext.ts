import {
  buildReferencePromptContextForProjectTurn,
  referencePromptContextTimelineFields,
  wrapReferenceContextForOrchestrationLlm,
  type ReferencePromptContextSection,
} from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryTimelineSummary } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import type { PreparedUserProjectKnowledgeMemoryPromptContexts } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsageRecording";
import {
  buildUserProjectKnowledgeMemoryTimelineSummaries,
  loadUserProjectKnowledgeMemoryControlForProject,
  prepareSameUserProjectKnowledgeMemoryPromptContexts,
} from "@/lib/project-knowledge/userMemoryFacade";

export type RequirementsTurnKnowledgeContext = Readonly<{
  readonly referencePromptContextBlock: string;
  readonly referencePlanningContextBlock: string;
  readonly referenceTimelineMeta: Record<string, unknown>;
  readonly userMemoryPrepared: PreparedUserProjectKnowledgeMemoryPromptContexts | null;
  readonly userMemoryControl: UserProjectKnowledgeMemoryControlV1 | null;
  readonly userMemoryTimelineMeta?: readonly UserProjectKnowledgeMemoryTimelineSummary[];
  readonly userMemoryTimelineTraceFields: Record<string, unknown>;
}>;

const NO_PROJECT_REFERENCE_SECTION = {
  hasReference: false,
  sourceSnapshotIds: [],
  mode: "SUMMARY" as const,
  summarySections: [],
  selectedNodes: [],
  promptText: "",
  diagnostics: {
    selectedNodeCount: 0,
    candidateNodeCount: 0,
    selectionQuery: "",
    selectionReason: "no_project",
  },
} as ReferencePromptContextSection;

export function buildRequirementsTurnUserMemoryTimelineTraceFields(input: {
  readonly prepared: PreparedUserProjectKnowledgeMemoryPromptContexts | null;
  readonly timelineMeta?: readonly UserProjectKnowledgeMemoryTimelineSummary[];
}): Record<string, unknown> {
  if (input.prepared == null) return {};
  return {
    ...(input.timelineMeta?.length ? { userProjectKnowledgeMemoryContexts: input.timelineMeta } : {}),
    ...(input.prepared.memoryControlEnabled === false
      ? { userProjectKnowledgeMemoryControlEnabled: false as const }
      : {}),
  };
}

export async function prepareRequirementsTurnKnowledgeContext(input: {
  readonly projectId?: string | null;
  readonly userId: string;
  readonly userMessage: string;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
  readonly bootstrapInterview?: boolean;
}): Promise<RequirementsTurnKnowledgeContext> {
  const projectId = String(input.projectId ?? "").trim();
  if (!projectId) {
    const referenceTimelineMeta = referencePromptContextTimelineFields(NO_PROJECT_REFERENCE_SECTION);
    return {
      referencePromptContextBlock: "",
      referencePlanningContextBlock: "",
      referenceTimelineMeta: referenceTimelineMeta as Record<string, unknown>,
      userMemoryPrepared: null,
      userMemoryControl: null,
      userMemoryTimelineMeta: undefined,
      userMemoryTimelineTraceFields: {},
    };
  }

  const referencePromptContextSection = await buildReferencePromptContextForProjectTurn({
    projectId,
    userMessage: input.bootstrapInterview ? "" : input.userMessage,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
  });
  const referencePromptContextBlock = referencePromptContextSection.hasReference
    ? wrapReferenceContextForOrchestrationLlm(referencePromptContextSection.promptText)
    : "";
  const referenceTimelineMeta = referencePromptContextTimelineFields(referencePromptContextSection);

  const userMemoryControl = await loadUserProjectKnowledgeMemoryControlForProject(projectId);
  const userMemoryPrepared = await prepareSameUserProjectKnowledgeMemoryPromptContexts({
    userId: input.userId,
    targetProjectId: projectId,
    control: userMemoryControl,
  });
  const userMemoryTimelineMeta = buildUserProjectKnowledgeMemoryTimelineSummaries(userMemoryPrepared.byAgent);
  const userMemoryTimelineTraceFields = buildRequirementsTurnUserMemoryTimelineTraceFields({
    prepared: userMemoryPrepared,
    timelineMeta: userMemoryTimelineMeta,
  });

  return {
    referencePromptContextBlock,
    referencePlanningContextBlock: referencePromptContextBlock,
    referenceTimelineMeta: referenceTimelineMeta as Record<string, unknown>,
    userMemoryPrepared,
    userMemoryControl,
    userMemoryTimelineMeta,
    userMemoryTimelineTraceFields,
  };
}
