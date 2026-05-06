import type { ServiceDesignStage } from "@/lib/service-design/serviceDesignAiHarness";
import { buildHarnessResponsePolicy, type HarnessResponsePolicy } from "@/lib/service-design/serviceDesignResponsePolicy";
import { detectIntent } from "@/lib/service-design/serviceDesignIntentRouter";
import type { Intent } from "@/lib/service-design/serviceDesignIntentRouter";
import { resolveMentionRouting, type MentionRoutingResult } from "@/lib/service-design/serviceDesignMentionRouter";
import { validateStep, type ValidationResult } from "@/lib/service-design/serviceDesignStepValidator";

export type HarnessRunResult = {
  intent: Intent;
  routing: MentionRoutingResult;
  validation: ValidationResult;
  responsePolicy: HarnessResponsePolicy;
};

export async function runHarness({
  input,
  stage,
  mentionedAI,
}: {
  input: string;
  stage: ServiceDesignStage;
  mentionedAI?: string | null;
}): Promise<HarnessRunResult> {
  const intent = detectIntent(input);

  const routing = resolveMentionRouting({
    stage,
    mentionedAI,
    intent,
  });

  const validation = validateStep(input, stage);

  const responsePolicy = buildHarnessResponsePolicy({
    intent,
    routing,
    validation,
  });

  return {
    intent,
    routing,
    validation,
    responsePolicy,
  };
}
