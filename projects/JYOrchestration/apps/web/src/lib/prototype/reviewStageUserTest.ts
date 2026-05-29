import type { ImplementationReviewStageReadyV1 } from "@/lib/prototype/implementationReviewStageReady";

export const REVIEW_STAGE_USER_TEST_SESSION_VERSION =
  "review_stage_user_test_session_v1" as const;

export type ReviewStageUserTestStatus =
  | "not_started"
  | "in_progress"
  | "feedback_registered"
  | "completed"
  | "returned_to_implementation";

export type ReviewStageUserTestSessionV1 = Readonly<{
  version: typeof REVIEW_STAGE_USER_TEST_SESSION_VERSION;
  projectId: string;
  status: ReviewStageUserTestStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  previewUrl?: string;
  summary?: string;
}>;

const SESSION_STATUSES = new Set<ReviewStageUserTestStatus>([
  "not_started",
  "in_progress",
  "feedback_registered",
  "completed",
  "returned_to_implementation",
]);

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

export function isReviewStageEntryReady(input: {
  readonly implementationReviewStageReadyV1?: ImplementationReviewStageReadyV1 | null;
  readonly previewReady?: boolean;
}): boolean {
  const marker = input.implementationReviewStageReadyV1;
  if (!marker?.ready || !marker.previewReady) return false;
  if (input.previewReady === false) return false;
  return true;
}

export function parseReviewStageUserTestSessionV1(
  raw: unknown,
): ReviewStageUserTestSessionV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== REVIEW_STAGE_USER_TEST_SESSION_VERSION) return null;
  const projectId = readString(o.projectId);
  const createdAt = readString(o.createdAt);
  const updatedAt = readString(o.updatedAt);
  const status = readString(o.status) as ReviewStageUserTestStatus;
  if (!projectId || !createdAt || !updatedAt || !SESSION_STATUSES.has(status)) return null;
  return {
    version: REVIEW_STAGE_USER_TEST_SESSION_VERSION,
    projectId,
    status,
    createdAt,
    updatedAt,
    ...(typeof o.startedAt === "string" && o.startedAt.trim() ? { startedAt: o.startedAt.trim() } : {}),
    ...(typeof o.completedAt === "string" && o.completedAt.trim()
      ? { completedAt: o.completedAt.trim() }
      : {}),
    ...(typeof o.previewUrl === "string" && o.previewUrl.trim() ? { previewUrl: o.previewUrl.trim() } : {}),
    ...(typeof o.summary === "string" && o.summary.trim() ? { summary: o.summary.trim() } : {}),
  };
}

export function buildInitialReviewStageUserTestSession(input: {
  readonly projectId: string;
  readonly previewUrl?: string;
  readonly nowIso?: string;
}): ReviewStageUserTestSessionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const previewUrl = input.previewUrl?.trim();
  return {
    version: REVIEW_STAGE_USER_TEST_SESSION_VERSION,
    projectId: input.projectId.trim(),
    status: "not_started",
    createdAt: now,
    updatedAt: now,
    ...(previewUrl ? { previewUrl } : {}),
  };
}

function withSessionUpdate(
  session: ReviewStageUserTestSessionV1,
  patch: Partial<ReviewStageUserTestSessionV1> & { readonly status: ReviewStageUserTestStatus },
  nowIso?: string,
): ReviewStageUserTestSessionV1 {
  const now = nowIso ?? new Date().toISOString();
  return {
    ...session,
    ...patch,
    updatedAt: now,
  };
}

export function markReviewStageUserTestStarted(input: {
  readonly session: ReviewStageUserTestSessionV1 | null | undefined;
  readonly projectId: string;
  readonly previewUrl?: string;
  readonly nowIso?: string;
}): ReviewStageUserTestSessionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const base =
    input.session ??
    buildInitialReviewStageUserTestSession({
      projectId: input.projectId,
      previewUrl: input.previewUrl,
      nowIso: now,
    });
  const previewUrl = input.previewUrl?.trim() || base.previewUrl;
  return withSessionUpdate(
    {
      ...base,
      ...(previewUrl ? { previewUrl } : {}),
      startedAt: base.startedAt ?? now,
    },
    { status: "in_progress" },
    now,
  );
}

export function markReviewStageUserTestFeedbackRegistered(input: {
  readonly session: ReviewStageUserTestSessionV1;
  readonly nowIso?: string;
}): ReviewStageUserTestSessionV1 {
  return withSessionUpdate(input.session, { status: "feedback_registered" }, input.nowIso);
}

export function markReviewStageUserTestCompleted(input: {
  readonly session: ReviewStageUserTestSessionV1;
  readonly summary?: string;
  readonly nowIso?: string;
}): ReviewStageUserTestSessionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  return withSessionUpdate(
    {
      ...input.session,
      completedAt: now,
      ...(input.summary?.trim() ? { summary: input.summary.trim() } : {}),
    },
    { status: "completed" },
    now,
  );
}

export function markReviewStageReturnedToImplementation(input: {
  readonly session: ReviewStageUserTestSessionV1;
  readonly nowIso?: string;
}): ReviewStageUserTestSessionV1 {
  return withSessionUpdate(input.session, { status: "returned_to_implementation" }, input.nowIso);
}
