import type {
  ProjectReferenceSelectionSummaryV1,
  ProjectReferenceSelectionV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import {
  getReferenceSelectionFromRequirementsState,
  getReferenceSelectionSummaryFromRequirementsState,
} from "@/lib/project-state/projectKnowledgeRequirementsStateAdapter";
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
    selection: getReferenceSelectionFromRequirementsState(state),
    summary: getReferenceSelectionSummaryFromRequirementsState(state),
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
