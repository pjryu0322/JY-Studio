export const IMPLEMENTATION_REVIEW_STAGE_READY_VERSION =
  "implementation_review_stage_ready_v1" as const;

export type ImplementationReviewStageReadyV1 = Readonly<{
  version: typeof IMPLEMENTATION_REVIEW_STAGE_READY_VERSION;
  ready: true;
  createdAt: string;
  source: "execution_board_complete";
  previewReady: boolean;
}>;

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

export function parseImplementationReviewStageReadyV1(
  raw: unknown,
): ImplementationReviewStageReadyV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== IMPLEMENTATION_REVIEW_STAGE_READY_VERSION) return null;
  const createdAt = readString(o.createdAt);
  if (!createdAt) return null;
  const source = readString(o.source);
  if (source !== "execution_board_complete") return null;
  return {
    version: IMPLEMENTATION_REVIEW_STAGE_READY_VERSION,
    ready: true,
    createdAt,
    source: "execution_board_complete",
    previewReady: o.previewReady === true,
  };
}

export function buildImplementationReviewStageReadyMarker(input: {
  readonly previewReady: boolean;
  readonly nowIso?: string;
}): ImplementationReviewStageReadyV1 {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    version: IMPLEMENTATION_REVIEW_STAGE_READY_VERSION,
    ready: true,
    createdAt: now,
    source: "execution_board_complete",
    previewReady: input.previewReady,
  };
}
