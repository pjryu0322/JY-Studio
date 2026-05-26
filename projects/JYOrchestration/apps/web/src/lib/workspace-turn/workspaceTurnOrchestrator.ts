import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { extractMentionedAI } from "@/lib/service-design/serviceDesignMentionExtract";
import { runHarness } from "@/lib/service-design/serviceDesignHarnessRuntime";
import { isExplicitImplementationExecutionRequest } from "@/lib/prototype/implementationUserFeedback";
import type {
  WorkspaceTurnConfig,
  WorkspaceTurnInput,
  WorkspaceTurnRunResult,
} from "@/lib/workspace-turn/workspaceTurnTypes";

export type RunWorkspaceTurnLlmInput<TContext, TPatch> = Readonly<{
  readonly config: WorkspaceTurnConfig<TContext, TPatch>;
  readonly input: WorkspaceTurnInput<TContext>;
  readonly apiKey: string;
  readonly nowIso?: string;
}>;

export async function runWorkspaceTurn<TContext, TPatch>(
  params: RunWorkspaceTurnLlmInput<TContext, TPatch>,
): Promise<WorkspaceTurnRunResult<TPatch>> {
  const { config, input, apiKey } = params;
  const nowIso = params.nowIso ?? new Date().toISOString();
  const text = String(input.userMessage ?? "").trim();

  if (!text) {
    const model = config.fallbackAnalyze(input);
    const statePatch = config.buildStatePatch({
      context: input.context,
      model,
      userMessage: text,
      userMessageId: input.userMessageId,
      nowIso,
    });
    return {
      mode: config.mode,
      modelResult: model,
      statePatch,
      timelineEntries: config.buildTimelineEntries({
        context: input.context,
        model,
        patch: statePatch,
        nowIso,
        source: "rule_fallback",
      }),
      source: "rule_fallback",
    };
  }

  if (
    config.mode === "implementation" &&
    isExplicitImplementationExecutionRequest(text)
  ) {
    const model = config.fallbackAnalyze(input);
    const statePatch = config.buildStatePatch({
      context: input.context,
      model,
      userMessage: text,
      userMessageId: input.userMessageId,
      nowIso,
    });
    return {
      mode: config.mode,
      modelResult: model,
      statePatch,
      timelineEntries: config.buildTimelineEntries({
        context: input.context,
        model,
        patch: statePatch,
        nowIso,
        source: "rule_fallback",
      }),
      source: "rule_fallback",
    };
  }

  const mentionedAI = input.mentionedAI ?? extractMentionedAI(text);
  const harness = await runHarness({
    input: text,
    stage: "feature-planning",
    mentionedAI,
  });

  let model = config.fallbackAnalyze(input);
  let source: "llm" | "rule_fallback" = "rule_fallback";

  try {
    const harnessPrefix = `
${config.responseContract}

[하네스]
intent=${harness.intent}
validation=${harness.validation}
visibleResponder=${harness.responsePolicy.responderLabel}
`.trim();

    const system = `${harnessPrefix}\n\n${config.buildSystemPrompt(input)}`;
    const user = config.buildUserPrompt(input);
    const modelId = resolveOpenAiModelFromEnv();

    const res = await postOpenAiChatCompletion({
      apiKey,
      model: modelId,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.25,
      responseFormatJsonObject: true,
    });

    if (res.ok && res.text) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(res.text) as unknown;
      } catch {
        parsed = null;
      }
      const validated = parsed ? config.validateModelJson(parsed) : null;
      if (validated) {
        model = validated;
        source = "llm";
      }
    }
  } catch {
    // rule fallback below
  }

  const statePatch = config.buildStatePatch({
    context: input.context,
    model,
    userMessage: text,
    userMessageId: input.userMessageId,
    nowIso,
  });

  return {
    mode: config.mode,
    modelResult: model,
    statePatch,
    timelineEntries: config.buildTimelineEntries({
      context: input.context,
      model,
      patch: statePatch,
      nowIso,
      source,
    }),
    source,
  };
}
