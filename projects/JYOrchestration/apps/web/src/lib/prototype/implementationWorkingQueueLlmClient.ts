import type { ImplementationIntentResolverInput } from "@/lib/prototype/implementationIntentResolverTypes";
import type { ImplementationPreviewFeedbackAnalyzerInput } from "@/lib/prototype/implementationPreviewFeedbackTypes";

export type WorkingQueueLlmIntentResponse = Readonly<{
  success: boolean;
  data?: Readonly<{
    result: import("@/lib/prototype/implementationIntentResolverTypes").ImplementationIntentResolverResult;
    trace: import("@/lib/prototype/implementationIntentResolverTypes").ImplementationIntentResolverLlmTrace;
  }>;
  message?: string;
}>;

export type WorkingQueueLlmPreviewFeedbackResponse = Readonly<{
  success: boolean;
  data?: Readonly<{
    analysis: import("@/lib/prototype/implementationPreviewFeedbackTypes").ImplementationPreviewFeedbackAnalysis;
    trace: import("@/lib/prototype/implementationPreviewFeedbackTypes").ImplementationPreviewFeedbackLlmTrace;
  }>;
  message?: string;
}>;

export async function postImplementationWorkingQueueIntentResolve(input: Readonly<{
  projectId: string;
  resolverInput: ImplementationIntentResolverInput;
  requirementsStateJson?: unknown;
}>): Promise<WorkingQueueLlmIntentResponse> {
  const res = await fetch("/api/prototype-execution/working-queue-llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      mode: "intent",
      payload: input.resolverInput,
      requirementsStateJson: input.requirementsStateJson,
    }),
  });
  return (await res.json()) as WorkingQueueLlmIntentResponse;
}

export async function postImplementationPreviewFeedbackAnalyze(input: Readonly<{
  projectId: string;
  analyzerInput: ImplementationPreviewFeedbackAnalyzerInput;
  requirementsStateJson?: unknown;
}>): Promise<WorkingQueueLlmPreviewFeedbackResponse> {
  const res = await fetch("/api/prototype-execution/working-queue-llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      mode: "preview_feedback",
      payload: input.analyzerInput,
      requirementsStateJson: input.requirementsStateJson,
    }),
  });
  return (await res.json()) as WorkingQueueLlmPreviewFeedbackResponse;
}
