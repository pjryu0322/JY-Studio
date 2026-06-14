import type { OpenAiMultimodalMessage } from "@/lib/ai/openAiChatMultimodal";

export type ImplementationLlmProviderPurpose =
  | "implementation_intent_resolver"
  | "implementation_preview_feedback";

export type ImplementationLlmProviderCapabilities = Readonly<{
  readonly text: boolean;
  readonly vision: boolean;
}>;

export type ImplementationLlmProviderConfig = Readonly<{
  readonly provider: string;
  readonly model: string;
  readonly apiKey: string;
  readonly capabilities: ImplementationLlmProviderCapabilities;
  readonly providerSource:
    | "project_execution_setup"
    | "user_default"
    | "env_fallback"
    | "dev_env_fallback"
    | "none";
}>;

export type ImplementationLlmProviderRequest = Readonly<{
  readonly projectId: string;
  readonly userId?: string | null;
  readonly purpose: ImplementationLlmProviderPurpose;
  readonly messages: readonly OpenAiMultimodalMessage[];
  readonly responseFormat: "json";
  readonly requiresVision?: boolean;
  readonly imageDataUrl?: string;
  readonly imageUrl?: string;
}>;

export type ImplementationLlmProviderResponse = Readonly<{
  readonly ok: boolean;
  readonly provider: string;
  readonly model: string;
  readonly capabilities: ImplementationLlmProviderCapabilities;
  readonly content?: string;
  readonly parsedJson?: unknown;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly trace?: Readonly<{
    readonly usedVision: boolean;
    readonly providerSource: ImplementationLlmProviderConfig["providerSource"];
    readonly fallbackReason?: string;
  }>;
}>;

export function modelSupportsVision(model: string): boolean {
  const m = model.trim().toLowerCase();
  return (
    m.includes("gpt-4o") ||
    m.includes("gpt-4-turbo") ||
    m.includes("gpt-4-vision") ||
    m.includes("o1") ||
    m.includes("o3")
  );
}
