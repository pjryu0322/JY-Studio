import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";

export const IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT = "implementation_preview_feedback" as const;

export function previewFeedbackTargetLine(item: ImplementationWorkingQueueItem): string {
  const fromAnalysis = item.targetUi?.trim();
  if (fromAnalysis) return fromAnalysis;
  return "Preview 캡처 영역의 UI 요소";
}

export function previewFeedbackActionLine(item: ImplementationWorkingQueueItem): string {
  const fromAnalysis = item.desiredBehavior?.trim();
  if (fromAnalysis) return fromAnalysis;
  const raw = item.rawUserMessage.trim();
  return raw.length <= 120 ? raw : `${raw.slice(0, 117)}…`;
}
