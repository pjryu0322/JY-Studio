import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";

/** Explainability trace가 어떤 경로로 붙었는지(UI는 `none`이면 패널 미표시). */
export type MessageExplainabilityTraceConfidence = "direct" | "response_text" | "role_time" | "none";

export type MessageExplainabilityTraceResolution = Readonly<{
  extract: ExtractedOverlayPromptTraceMetadata | null;
  confidence: MessageExplainabilityTraceConfidence;
}>;
