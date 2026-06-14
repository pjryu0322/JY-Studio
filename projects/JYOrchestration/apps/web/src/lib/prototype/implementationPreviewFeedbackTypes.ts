import type { ImplementationWorkingQueueAffectedArea, ImplementationWorkingQueueRiskLevel } from "@/lib/prototype/implementationWorkingQueueTypes";

export type ImplementationPreviewFeedbackAnalysis = Readonly<{
  readonly intent: "implementation_preview_feedback";
  readonly title: string;
  readonly description: string;
  readonly targetUi?: string;
  readonly desiredBehavior: string;
  readonly affectedArea: ImplementationWorkingQueueAffectedArea;
  readonly riskLevel: ImplementationWorkingQueueRiskLevel;
  readonly needsClarification: boolean;
  readonly clarificationQuestion?: string;
  readonly confidence: "low" | "medium" | "high";
  readonly reason: string;
}>;

export type ImplementationPreviewFeedbackAnalyzerInput = Readonly<{
  readonly projectId: string;
  readonly userText: string;
  readonly previewUrl?: string;
  readonly captureId?: string;
  readonly regionCaptureId?: string;
  readonly imageUrl?: string;
  readonly imageDataUrl?: string;
  readonly rect?: Readonly<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number }>;
  readonly recentMessages?: ReadonlyArray<{ readonly role: "user" | "assistant"; readonly content: string }>;
}>;

export type ImplementationPreviewFeedbackLlmTrace = Readonly<{
  readonly source: "llm_vision" | "llm_text" | "fallback";
  readonly model?: string;
  readonly reason?: string;
  readonly usedVision?: boolean;
  readonly providerSource?: string;
  readonly fallbackReason?: string;
}>;

const AREAS = new Set<ImplementationWorkingQueueAffectedArea>([
  "ui",
  "flow",
  "feature",
  "data",
  "style",
  "bug",
  "unknown",
]);
const RISKS = new Set<ImplementationWorkingQueueRiskLevel>(["low", "medium", "high"]);
const CONF = new Set(["low", "medium", "high"] as const);

export function parseImplementationPreviewFeedbackAnalysisJson(raw: unknown): ImplementationPreviewFeedbackAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const description = typeof o.description === "string" ? o.description.trim() : "";
  const desiredBehavior = typeof o.desiredBehavior === "string" ? o.desiredBehavior.trim() : "";
  const reason = typeof o.reason === "string" ? o.reason.trim() : "";
  if (!title || !description || !desiredBehavior || !reason) return null;
  const areaRaw = String(o.affectedArea ?? "unknown").trim() as ImplementationWorkingQueueAffectedArea;
  const riskRaw = String(o.riskLevel ?? "low").trim() as ImplementationWorkingQueueRiskLevel;
  if (!AREAS.has(areaRaw) || !RISKS.has(riskRaw)) return null;
  const confidenceRaw = String(o.confidence ?? "medium").trim();
  const confidence = CONF.has(confidenceRaw as "low") ? (confidenceRaw as "low" | "medium" | "high") : "medium";
  const targetUi = typeof o.targetUi === "string" ? o.targetUi.trim() : undefined;
  const needsClarification = o.needsClarification === true;
  const clarificationQuestion =
    typeof o.clarificationQuestion === "string" ? o.clarificationQuestion.trim().slice(0, 500) : undefined;
  return {
    intent: "implementation_preview_feedback",
    title: title.slice(0, 120),
    description: description.slice(0, 800),
    ...(targetUi ? { targetUi: targetUi.slice(0, 200) } : {}),
    desiredBehavior: desiredBehavior.slice(0, 400),
    affectedArea: areaRaw,
    riskLevel: riskRaw,
    needsClarification,
    ...(clarificationQuestion ? { clarificationQuestion } : {}),
    confidence,
    reason: reason.slice(0, 500),
  };
}

export function buildMinimalPreviewFeedbackFallback(userText: string): ImplementationPreviewFeedbackAnalysis {
  const raw = userText.trim();
  return {
    intent: "implementation_preview_feedback",
    title: "Preview 캡처 기반 보완요청",
    description: raw,
    desiredBehavior: raw,
    affectedArea: "unknown",
    riskLevel: "medium",
    needsClarification: false,
    confidence: "low",
    reason: "LLM unavailable — preserved user text only, no keyword inference",
  };
}
