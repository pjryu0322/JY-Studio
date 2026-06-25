import { prisma } from "@/lib/prisma";
import {
  parseProjectReferenceSelectionSummaryV1,
  parseProjectReferenceSelectionV1,
  type ProjectReferenceSelectionSummaryV1,
  type ProjectReferenceSelectionV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildReferencePromptContextForProjectTurn } from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";

export {
  parseProjectReferenceSelectionSummaryV1,
  parseProjectReferenceSelectionV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";

export function readReferenceSelectionFromRequirementsState(
  state: RequirementsStateJson | null | undefined,
): Readonly<{
  selection: ProjectReferenceSelectionV1 | null;
  summary: ProjectReferenceSelectionSummaryV1 | null;
}> {
  return {
    selection: parseProjectReferenceSelectionV1(state?.referenceSelectionV1),
    summary: parseProjectReferenceSelectionSummaryV1(state?.referenceSelectionSummaryV1),
  };
}

export async function loadReferencePlanningContextPromptBlockForProject(
  projectId: string,
  options?: Readonly<{
    readonly userMessage?: string;
    readonly projectName?: string | null;
    readonly projectDescription?: string | null;
  }>,
): Promise<string> {
  const section = await buildReferencePromptContextForProjectTurn({
    projectId,
    userMessage: options?.userMessage ?? "",
    projectName: options?.projectName,
    projectDescription: options?.projectDescription,
  });
  return section.promptText;
}

export {
  buildReferencePromptContextForProjectTurn,
  referencePromptContextTimelineFields,
  wrapReferenceContextForOrchestrationLlm,
} from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";
