import { runHarness } from "@/lib/service-design/serviceDesignHarnessRuntime";

export async function runServiceDesignHarnessTurn(params: {
  input: string;
  stage: "ideation" | "service-flow" | "feature-planning";
  mentionedAI?: string | null;
}) {
  const harness = await runHarness({
    input: params.input,
    stage: params.stage,
    mentionedAI: params.mentionedAI ?? null,
  });

  return harness;
}

