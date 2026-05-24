/**
 * Platform Orchestration Run Contract — shared envelope for all platform flows.
 * Phase 1: types only; existing feature pipelines are not wired here yet.
 */

export type PlatformFlowId =
  | "single_chat_turn"
  | "slot_action"
  | "planning_slots"
  | "fast_plan_draft"
  | "fast_plan_generation"
  | "service_flow"
  | "feature_design"
  | "deliverable_generation"
  | "prototype_generation"
  | "execution_runtime"
  | "review_security_scm";

export type PlatformTriggerSource =
  | "typed_text"
  | "quick_reply"
  | "slot_action"
  | "cta"
  | "system"
  | "runtime";

export type PlatformConversationScope =
  | "pre_project_messenger"
  | "project_single_chat"
  | "project_workspace"
  | "execution_runtime";

export type PlatformOrchestrationTrigger = Readonly<{
  readonly triggerId: string;
  readonly flowId: PlatformFlowId;
  readonly source: PlatformTriggerSource;
  readonly projectId: string | null;
  readonly roomId?: string | null;
  readonly conversationScope: PlatformConversationScope;
  readonly userId?: string | null;
  readonly payload: unknown;
  readonly createdAt: string;
}>;

export type PlatformMemberRole =
  | "planner"
  | "analyst"
  | "architect"
  | "designer"
  | "developer"
  | "reviewer"
  | "security"
  | "scm"
  | "aa"
  | "da"
  | "etl"
  | "eai"
  | "vlm_analyst";

export type PlatformMemberRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type PlatformMemberRun = Readonly<{
  readonly runId: string;
  readonly flowId: PlatformFlowId;
  readonly agentId: string;
  readonly role: PlatformMemberRole;
  readonly status: PlatformMemberRunStatus;
  readonly targetSlotKeys?: readonly string[];
  readonly inputSummary?: string;
  readonly outputSummary?: string;
  readonly traceId?: string | null;
  readonly startedAt?: string | null;
  readonly completedAt?: string | null;
}>;

export type PlatformDraftConfidence =
  | "confirmed"
  | "partial"
  | "candidate"
  | "assumed_for_prototype";

export type PlatformMemberDraft = Readonly<{
  readonly draftId: string;
  readonly runId: string;
  readonly agentId: string;
  readonly role: PlatformMemberRole;
  readonly targetSlotKeys?: readonly string[];
  readonly content: string;
  readonly confidence: PlatformDraftConfidence;
  readonly assumptions?: readonly string[];
}>;

export type PlatformStatePatchKind =
  | "single_chat_orchestration"
  | "requirements_state"
  | "service_flow"
  | "fast_plan"
  | "artifact"
  | "execution_runtime";

export type PlatformStatePatch = Readonly<{
  readonly patchId: string;
  readonly kind: PlatformStatePatchKind;
  readonly summary: string;
  readonly payload: unknown;
}>;

export type PlatformTimelineEventType =
  | "trigger_received"
  | "member_selected"
  | "member_run_started"
  | "member_run_completed"
  | "state_patched"
  | "next_action_created"
  | "validation_checked"
  | "runtime_handoff";

export type PlatformTimelineEvent = Readonly<{
  readonly eventId: string;
  readonly flowId: PlatformFlowId;
  readonly eventType: PlatformTimelineEventType;
  readonly message: string;
  readonly at: string;
  readonly detail?: unknown;
}>;

export type PlatformNextActionKind =
  | "chat_reply"
  | "slot_action"
  | "flow_transition"
  | "artifact_generation"
  | "prototype_generation"
  | "runtime_execution"
  | "manual_review";

export type PlatformNextAction = Readonly<{
  readonly id: string;
  readonly label: string;
  readonly kind: PlatformNextActionKind;
  readonly flowId?: PlatformFlowId;
  readonly enabled: boolean;
  readonly disabledReason?: string | null;
  readonly payload?: unknown;
}>;

export type PlatformRunResult = Readonly<{
  readonly flowId: PlatformFlowId;
  readonly trigger: PlatformOrchestrationTrigger;
  readonly memberRuns: readonly PlatformMemberRun[];
  readonly memberDrafts: readonly PlatformMemberDraft[];
  readonly statePatches: readonly PlatformStatePatch[];
  readonly timelineEvents: readonly PlatformTimelineEvent[];
  readonly nextActions: readonly PlatformNextAction[];
  readonly userMessage?: string;
}>;
