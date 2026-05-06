import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { extractMentionedAI } from "@/lib/service-design/serviceDesignMentionExtract";

export type ServiceDesignHarnessPayload = {
  serviceDesignStage: RequirementsWorkspaceStage;
  mentionedAI: string | null;
};

export function buildServiceDesignHarnessPayload(
  stage: RequirementsWorkspaceStage,
  userMessage: string
): ServiceDesignHarnessPayload {
  return {
    serviceDesignStage: stage,
    mentionedAI: extractMentionedAI(userMessage),
  };
}
