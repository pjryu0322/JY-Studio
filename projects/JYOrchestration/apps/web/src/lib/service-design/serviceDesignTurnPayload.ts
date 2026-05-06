import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { extractMentionedAI } from "@/lib/service-design/serviceDesignMentionExtract";

/** Harness-aligned extras for service-design turns (merge into request bodies when wiring unified turn API). */
export function buildServiceDesignHarnessPayload(stage: RequirementsWorkspaceStage, userMessage: string) {
  return {
    serviceDesignStage: stage,
    mentionedAI: extractMentionedAI(userMessage),
  };
}
