import type { PreviewCaptureRegionRect } from "@/lib/preview/previewCaptureTypes";
import {
  buildWorkingQueueItemTitle,
  inferWorkingQueueAffectedArea,
  inferWorkingQueueRiskLevel,
} from "@/lib/prototype/implementationWorkingQueueClassifier";
import type {
  ImplementationWorkingQueueAffectedArea,
  ImplementationWorkingQueueItem,
} from "@/lib/prototype/implementationWorkingQueueTypes";

export const IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT = "implementation_preview_feedback" as const;

export function buildPreviewFeedbackQueueDescription(rawUserMessage: string): string {
  const text = rawUserMessage.trim();
  if (/스크립트/.test(text) && /클릭|탭|이벤트/.test(text)) {
    return "결과 패널의 스크립트 탭 또는 스크립트 영역에 UI interaction(클릭 시 내용 표시 등)을 추가한다.";
  }
  if (/클릭|탭/.test(text) && /보여|표시|펼/.test(text)) {
    return "캡처 영역의 UI 요소를 사용자가 클릭·탭하면 해당 내용을 표시하도록 interaction을 추가한다.";
  }
  return `Preview 캡처 영역 기준 보완요청: ${text}`;
}

export function inferPreviewFeedbackTargetLine(item: ImplementationWorkingQueueItem): string {
  const text = item.rawUserMessage;
  if (/스크립트/.test(text) && /탭/.test(text)) return "결과 패널의 스크립트 탭";
  if (/스크립트/.test(text)) return "캡처된 결과 패널의 스크립트 영역";
  return "Preview 캡처 영역의 UI 요소";
}

export function inferPreviewFeedbackActionLine(item: ImplementationWorkingQueueItem): string {
  const text = item.rawUserMessage.trim();
  if (/클릭|탭/.test(text) && /보여|표시|펼/.test(text)) {
    return "클릭·탭 시 해당 내용을 표시";
  }
  if (/클릭|이벤트|탭/.test(text)) {
    return text.replace(/\s+/g, " ");
  }
  return text.length <= 80 ? text : `${text.slice(0, 77)}…`;
}

export function buildPreviewFeedbackQueueItemFields(input: {
  readonly projectId: string;
  readonly rawUserMessage: string;
  readonly sourceMessageId?: string;
  readonly sourceCaptureId?: string;
  readonly regionCaptureId?: string;
  readonly previewUrl?: string;
  readonly rect?: PreviewCaptureRegionRect;
  readonly nowIso: string;
  readonly newItemId: string;
}): Pick<
  ImplementationWorkingQueueItem,
  | "id"
  | "projectId"
  | "sourceMessageId"
  | "rawUserMessage"
  | "title"
  | "description"
  | "affectedArea"
  | "status"
  | "riskLevel"
  | "createdAt"
  | "updatedAt"
  | "sourceCaptureId"
  | "regionCaptureId"
  | "previewUrl"
  | "rect"
> {
  const raw = input.rawUserMessage.trim();
  const area: ImplementationWorkingQueueAffectedArea = inferWorkingQueueAffectedArea(raw);
  return {
    id: input.newItemId,
    projectId: input.projectId.trim(),
    sourceMessageId: input.sourceMessageId,
    rawUserMessage: raw,
    title: buildWorkingQueueItemTitle(raw),
    description: buildPreviewFeedbackQueueDescription(raw),
    affectedArea: area,
    status: "pending",
    riskLevel: inferWorkingQueueRiskLevel(area, raw),
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
    ...(input.sourceCaptureId ? { sourceCaptureId: input.sourceCaptureId } : {}),
    ...(input.regionCaptureId ? { regionCaptureId: input.regionCaptureId } : {}),
    ...(input.previewUrl ? { previewUrl: input.previewUrl } : {}),
    ...(input.rect ? { rect: input.rect } : {}),
  };
}
