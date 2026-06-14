import type { OpenAiMultimodalMessage } from "@/lib/ai/openAiChatMultimodal";

export type ImplementationLlmProviderPurpose =
  | "implementation_intent_resolver"
  | "implementation_preview_feedback"
  | "implementation_code_task_refinement";

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
    | "dev_env_fallback"
    | "none";
}>;

export type ImplementationLlmProviderRequest = Readonly<{
  readonly projectId: string;
  readonly userId?: string | null;
  readonly requirementsStateJson?: unknown;
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
    readonly capabilitySource?: "provider_config";
    readonly envFallback?: boolean;
  }>;
}>;

export function modelSupportsVision(_model: string): boolean {
  /** @deprecated Product path uses providerConfig.capabilities.vision only. */
  return false;
}
