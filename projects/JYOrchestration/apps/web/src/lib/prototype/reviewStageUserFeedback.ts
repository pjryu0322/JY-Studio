import {
  appendReworkRequest,
  type ImplementationExecutionBoardStateV1,
} from "@/lib/prototype/implementationExecutionBoardState";

export const REVIEW_STAGE_USER_FEEDBACK_VERSION = "review_stage_user_feedback_v1" as const;

export type ReviewStageFeedbackCategory =
  | "screen"
  | "flow"
  | "function"
  | "data"
  | "copy"
  | "usability"
  | "bug"
  | "other";

export type ReviewStageFeedbackSeverity = "low" | "medium" | "high" | "blocking";

export type ReviewStageFeedbackStatus =
  | "registered"
  | "converted_to_rework"
  | "in_implementation"
  | "resolved"
  | "rejected";

export type ReviewStageUserFeedbackItemV1 = Readonly<{
  feedbackId: string;
  status: ReviewStageFeedbackStatus;
  category: ReviewStageFeedbackCategory;
  severity: ReviewStageFeedbackSeverity;
  title: string;
  detail: string;
  targetScreen?: string;
  targetTaskId?: string;
  createdAt: string;
  updatedAt: string;
  convertedReworkRequestId?: string;
}>;

export type ReviewStageUserFeedbackListV1 = Readonly<{
  version: typeof REVIEW_STAGE_USER_FEEDBACK_VERSION;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  items: readonly ReviewStageUserFeedbackItemV1[];
}>;

const CATEGORIES = new Set<ReviewStageFeedbackCategory>([
  "screen",
  "flow",
  "function",
  "data",
  "copy",
  "usability",
  "bug",
  "other",
]);

const SEVERITIES = new Set<ReviewStageFeedbackSeverity>(["low", "medium", "high", "blocking"]);

const STATUSES = new Set<ReviewStageFeedbackStatus>([
  "registered",
  "converted_to_rework",
  "in_implementation",
  "resolved",
  "rejected",
]);

const ACTIVE_FEEDBACK_STATUSES = new Set<ReviewStageFeedbackStatus>(["registered"]);

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function parseFeedbackItem(raw: unknown): ReviewStageUserFeedbackItemV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const feedbackId = readString(o.feedbackId);
  const title = readString(o.title);
  const detail = readString(o.detail);
  const status = readString(o.status) as ReviewStageFeedbackStatus;
  const category = readString(o.category) as ReviewStageFeedbackCategory;
  const severity = readString(o.severity) as ReviewStageFeedbackSeverity;
  const createdAt = readString(o.createdAt);
  const updatedAt = readString(o.updatedAt);
  if (!feedbackId || !title || !createdAt || !updatedAt) return null;
  if (!STATUSES.has(status) || !CATEGORIES.has(category) || !SEVERITIES.has(severity)) return null;
  return {
    feedbackId,
    status,
    category,
    severity,
    title,
    detail: detail || title,
    createdAt,
    updatedAt,
    ...(typeof o.targetScreen === "string" && o.targetScreen.trim()
      ? { targetScreen: o.targetScreen.trim() }
      : {}),
    ...(typeof o.targetTaskId === "string" && o.targetTaskId.trim()
      ? { targetTaskId: o.targetTaskId.trim() }
      : {}),
    ...(typeof o.convertedReworkRequestId === "string" && o.convertedReworkRequestId.trim()
      ? { convertedReworkRequestId: o.convertedReworkRequestId.trim() }
      : {}),
  };
}

export function parseReviewStageUserFeedbackListV1(
  raw: unknown,
): ReviewStageUserFeedbackListV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== REVIEW_STAGE_USER_FEEDBACK_VERSION) return null;
  const projectId = readString(o.projectId);
  const createdAt = readString(o.createdAt);
  const updatedAt = readString(o.updatedAt);
  if (!projectId || !createdAt || !updatedAt) return null;
  const items: ReviewStageUserFeedbackItemV1[] = [];
  if (Array.isArray(o.items)) {
    for (const row of o.items) {
      const parsed = parseFeedbackItem(row);
      if (parsed) items.push(parsed);
    }
  }
  return {
    version: REVIEW_STAGE_USER_FEEDBACK_VERSION,
    projectId,
    createdAt,
    updatedAt,
    items,
  };
}

export function buildInitialReviewStageUserFeedbackList(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): ReviewStageUserFeedbackListV1 {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    version: REVIEW_STAGE_USER_FEEDBACK_VERSION,
    projectId: input.projectId.trim(),
    createdAt: now,
    updatedAt: now,
    items: [],
  };
}

export function getActiveReviewFeedbackItems(
  list: ReviewStageUserFeedbackListV1 | null | undefined,
): readonly ReviewStageUserFeedbackItemV1[] {
  if (!list?.items.length) return [];
  return list.items.filter((item) => ACTIVE_FEEDBACK_STATUSES.has(item.status));
}

export function summarizeReviewStageUserFeedback(
  list: ReviewStageUserFeedbackListV1 | null | undefined,
): Readonly<{
  readonly total: number;
  readonly active: number;
  readonly blocking: number;
}> {
  const items = list?.items ?? [];
  const activeItems = getActiveReviewFeedbackItems(list);
  return {
    total: items.length,
    active: activeItems.length,
    blocking: activeItems.filter((item) => item.severity === "blocking").length,
  };
}

export function appendReviewStageUserFeedback(input: {
  readonly list: ReviewStageUserFeedbackListV1 | null | undefined;
  readonly projectId: string;
  readonly title: string;
  readonly detail: string;
  readonly category?: ReviewStageFeedbackCategory;
  readonly severity?: ReviewStageFeedbackSeverity;
  readonly targetScreen?: string;
  readonly targetTaskId?: string;
  readonly nowIso?: string;
  readonly feedbackId?: string;
}): ReviewStageUserFeedbackListV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const base =
    input.list ??
    buildInitialReviewStageUserFeedbackList({ projectId: input.projectId, nowIso: now });
  const feedbackId =
    input.feedbackId?.trim() ||
    `review-fb-${now.replace(/[:.]/g, "-")}-${base.items.length + 1}`;
  const item: ReviewStageUserFeedbackItemV1 = {
    feedbackId,
    status: "registered",
    category: input.category && CATEGORIES.has(input.category) ? input.category : "other",
    severity: input.severity && SEVERITIES.has(input.severity) ? input.severity : "medium",
    title: input.title.trim(),
    detail: input.detail.trim() || input.title.trim(),
    createdAt: now,
    updatedAt: now,
    ...(input.targetScreen?.trim() ? { targetScreen: input.targetScreen.trim() } : {}),
    ...(input.targetTaskId?.trim() ? { targetTaskId: input.targetTaskId.trim() } : {}),
  };
  return {
    ...base,
    updatedAt: now,
    items: [...base.items, item],
  };
}

export function markReviewFeedbackConvertedToRework(input: {
  readonly list: ReviewStageUserFeedbackListV1;
  readonly feedbackId: string;
  readonly reworkRequestId: string;
  readonly nowIso?: string;
}): ReviewStageUserFeedbackListV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const feedbackId = input.feedbackId.trim();
  return {
    ...input.list,
    updatedAt: now,
    items: input.list.items.map((item) =>
      item.feedbackId === feedbackId
        ? {
            ...item,
            status: "converted_to_rework",
            updatedAt: now,
            convertedReworkRequestId: input.reworkRequestId.trim(),
          }
        : item,
    ),
  };
}

export function canCompleteReviewStage(input: {
  readonly feedbackList?: ReviewStageUserFeedbackListV1 | null;
}): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  const blocking = getActiveReviewFeedbackItems(input.feedbackList).filter(
    (item) => item.severity === "blocking",
  );
  if (blocking.length) {
    return {
      ok: false,
      message: `blocking 피드백 ${blocking.length}건을 먼저 처리하거나 구현단계 보완 요청으로 전환해 주세요.`,
    };
  }
  return { ok: true };
}

export function convertReviewFeedbackToImplementationRework(input: {
  readonly feedbackList: ReviewStageUserFeedbackListV1;
  readonly boardState: ImplementationExecutionBoardStateV1 | null | undefined;
  readonly projectId: string;
  readonly feedbackId: string;
  readonly fallbackTaskId: string;
  readonly nowIso?: string;
}): {
  readonly feedbackList: ReviewStageUserFeedbackListV1;
  readonly boardState: ImplementationExecutionBoardStateV1;
  readonly reworkRequestId: string;
} {
  const now = input.nowIso ?? new Date().toISOString();
  const item = input.feedbackList.items.find((row) => row.feedbackId === input.feedbackId.trim());
  if (!item) {
    throw new Error("피드백 항목을 찾을 수 없습니다.");
  }
  const taskId = item.targetTaskId?.trim() || input.fallbackTaskId.trim();
  const reworkRequestId = `rework-review-${item.feedbackId}-${now.replace(/[:.]/g, "-")}`;
  const reason = `[검토단계 피드백] ${item.title}${item.detail ? `: ${item.detail}` : ""}`;
  const boardState = appendReworkRequest({
    state: input.boardState,
    projectId: input.projectId,
    taskId,
    targetRole: "developer",
    reason,
    nowIso: now,
    requestId: reworkRequestId,
  });
  const feedbackList = markReviewFeedbackConvertedToRework({
    list: input.feedbackList,
    feedbackId: item.feedbackId,
    reworkRequestId,
    nowIso: now,
  });
  return { feedbackList, boardState, reworkRequestId };
}
