import { SERVICE_DESIGN_AI, type ServiceDesignStage } from "@/lib/service-design/serviceDesignAiHarness";
import type { Intent } from "@/lib/service-design/serviceDesignIntentRouter";

export type MentionRoutingResult = {
  visibleResponder: string;
  internalAdvisors: string[];
  finalAuthority: string;
  mode: "DIRECT" | "ADVISORY" | "BLOCK" | "REDIRECT";
};

export function resolveMentionRouting({
  stage,
  mentionedAI,
  intent,
}: {
  stage: ServiceDesignStage;
  mentionedAI?: string | null;
  intent: Intent;
}): MentionRoutingResult {
  const primary = SERVICE_DESIGN_AI[stage].primary;

  let advisors: string[] = [];

  if (intent === "SECURITY") advisors = ["security_reviewer"];
  if (intent === "DESIGN") advisors = ["designer"];
  if (intent === "DEPLOY") advisors = ["scm_manager"];

  return {
    visibleResponder: mentionedAI ?? primary,
    internalAdvisors: advisors,
    finalAuthority: primary,
    mode: advisors.length ? "ADVISORY" : "DIRECT",
  };
}
