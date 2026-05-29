import { buildReviewStageEntryMessage } from "@/lib/prototype/reviewStageMessage";
import { isReviewStageEntryReady } from "@/lib/prototype/reviewStageUserTest";
import type { ImplementationReviewStageReadyV1 } from "@/lib/prototype/implementationReviewStageReady";
import type { ReviewStageUserFeedbackListV1 } from "@/lib/prototype/reviewStageUserFeedback";
import type { ReviewStageUserTestSessionV1 } from "@/lib/prototype/reviewStageUserTest";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export function buildReviewStageEntryNoticeLines(input: {
  readonly implementationReviewStageReadyV1?: ImplementationReviewStageReadyV1 | null;
  readonly previewReady?: boolean;
  readonly session?: ReviewStageUserTestSessionV1 | null;
  readonly feedbackList?: ReviewStageUserFeedbackListV1 | null;
  readonly previewUrl?: string;
}): readonly string[] {
  const entryReady = isReviewStageEntryReady({
    implementationReviewStageReadyV1: input.implementationReviewStageReadyV1,
    previewReady: input.previewReady,
  });
  const message = buildReviewStageEntryMessage({
    entryReady,
    implementationReviewStageReadyV1: input.implementationReviewStageReadyV1,
    previewReady: input.previewReady,
    session: input.session,
    feedbackList: input.feedbackList,
    previewUrl: input.previewUrl,
  });
  return message.content.split("\n").filter((line) => line.trim().length > 0);
}

export function buildReviewStageEntryRequirementsMessage(input: {
  readonly implementationReviewStageReadyV1?: ImplementationReviewStageReadyV1 | null;
  readonly previewReady?: boolean;
  readonly session?: ReviewStageUserTestSessionV1 | null;
  readonly feedbackList?: ReviewStageUserFeedbackListV1 | null;
  readonly previewUrl?: string;
  readonly nowIso?: string;
}): RequirementsMessage {
  const entryReady = isReviewStageEntryReady({
    implementationReviewStageReadyV1: input.implementationReviewStageReadyV1,
    previewReady: input.previewReady,
  });
  return buildReviewStageEntryMessage({
    entryReady,
    implementationReviewStageReadyV1: input.implementationReviewStageReadyV1,
    previewReady: input.previewReady,
    session: input.session,
    feedbackList: input.feedbackList,
    previewUrl: input.previewUrl,
    nowIso: input.nowIso,
  });
}
