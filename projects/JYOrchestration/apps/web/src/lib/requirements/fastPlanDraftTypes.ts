/**
 * fast_plan_draft — AI team draft proposal before fast_prototype_plan artifact generation.
 */

import type { FastPlanAssumption } from "@/lib/requirements/fastPlanGenerationTypes";
import type {
  PlatformMemberDraft,
  PlatformMemberRun,
} from "@/lib/platform-orchestration/types";

export const FAST_PLAN_DRAFT_PROPOSAL_INTERNAL_TYPE = "fast_plan_draft_proposal" as const;

export type FastPlanDraftStatus = "proposed";

export type FastPlanDraftStateV1 = Readonly<{
  readonly status: FastPlanDraftStatus;
  readonly generatedAt: string;
  readonly flowId: "fast_plan_draft";
  readonly memberRuns: readonly PlatformMemberRun[];
  readonly memberDrafts: readonly PlatformMemberDraft[];
  readonly assumptions: readonly FastPlanAssumption[];
  readonly source: "current_conversation_and_slots";
}>;
