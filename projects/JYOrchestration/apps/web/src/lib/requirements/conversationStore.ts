import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export type RequirementsConversation = {
  projectId: string;
  stage: "REQUIREMENTS";
  messages: RequirementsMessage[];
};

export function newConversation(projectId: string, messages: RequirementsMessage[] = []): RequirementsConversation {
  return { projectId, stage: "REQUIREMENTS", messages };
}

