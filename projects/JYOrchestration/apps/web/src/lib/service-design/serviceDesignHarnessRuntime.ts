import { detectIntent } from "@/lib/service-design/serviceDesignIntentRouter";
import { resolveMentionRouting } from "@/lib/service-design/serviceDesignMentionRouter";
import type { ServiceDesignStage } from "@/lib/service-design/serviceDesignAiHarness";
import { validateStep } from "@/lib/service-design/serviceDesignStepValidator";

export async function runHarness({
  input,
  stage,
  mentionedAI,
}: {
  input: string;
  stage: ServiceDesignStage;
  mentionedAI?: string | null;
}) {
  const intent = detectIntent(input);

  const routing = resolveMentionRouting({
    stage,
    mentionedAI,
    intent,
  });

  const validation = validateStep(input, stage);

  return {
    intent,
    routing,
    validation,
  };
}
