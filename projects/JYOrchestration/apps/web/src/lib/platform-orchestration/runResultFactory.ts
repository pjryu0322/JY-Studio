import { newPlatformOrchestrationId, platformOrchestrationNowIso } from "@/lib/platform-orchestration/platformIds";
import type {
  PlatformConversationScope,
  PlatformFlowId,
  PlatformMemberDraft,
  PlatformMemberRole,
  PlatformMemberRun,
  PlatformMemberRunStatus,
  PlatformNextAction,
  PlatformOrchestrationTrigger,
  PlatformRunResult,
  PlatformStatePatch,
  PlatformTimelineEvent,
  PlatformTimelineEventType,
  PlatformTriggerSource,
} from "@/lib/platform-orchestration/types";

export type CreatePlatformTriggerInput = Readonly<{
  readonly flowId: PlatformFlowId;
  readonly source: PlatformTriggerSource;
  readonly projectId?: string | null;
  readonly roomId?: string | null;
  readonly conversationScope: PlatformConversationScope;
  readonly userId?: string | null;
  readonly payload?: unknown;
  readonly createdAt?: string;
  readonly triggerId?: string;
}>;

export function createPlatformTrigger(input: CreatePlatformTriggerInput): PlatformOrchestrationTrigger {
  return {
    triggerId: input.triggerId ?? newPlatformOrchestrationId("ptr"),
    flowId: input.flowId,
    source: input.source,
    projectId: input.projectId ?? null,
    roomId: input.roomId ?? null,
    conversationScope: input.conversationScope,
    userId: input.userId ?? null,
    payload: input.payload ?? null,
    createdAt: input.createdAt ?? platformOrchestrationNowIso(),
  };
}

export type CreateMemberRunInput = Readonly<{
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
  readonly runId?: string;
}>;

function createMemberRun(input: CreateMemberRunInput): PlatformMemberRun {
  return {
    runId: input.runId ?? newPlatformOrchestrationId("mrun"),
    flowId: input.flowId,
    agentId: input.agentId,
    role: input.role,
    status: input.status,
    targetSlotKeys: input.targetSlotKeys,
    inputSummary: input.inputSummary,
    outputSummary: input.outputSummary,
    traceId: input.traceId ?? null,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
  };
}

export function createSkippedMemberRun(
  input: Omit<CreateMemberRunInput, "status"> & { readonly reason?: string },
): PlatformMemberRun {
  return createMemberRun({
    ...input,
    status: "skipped",
    outputSummary: input.outputSummary ?? input.reason,
  });
}

export function createCompletedMemberRun(
  input: Omit<CreateMemberRunInput, "status">,
): PlatformMemberRun {
  const at = platformOrchestrationNowIso();
  return createMemberRun({
    ...input,
    status: "completed",
    startedAt: input.startedAt ?? at,
    completedAt: input.completedAt ?? at,
  });
}

export function createPlatformTimelineEvent(input: {
  readonly flowId: PlatformFlowId;
  readonly eventType: PlatformTimelineEventType;
  readonly message: string;
  readonly at?: string;
  readonly detail?: unknown;
  readonly eventId?: string;
}): PlatformTimelineEvent {
  return {
    eventId: input.eventId ?? newPlatformOrchestrationId("tev"),
    flowId: input.flowId,
    eventType: input.eventType,
    message: input.message,
    at: input.at ?? platformOrchestrationNowIso(),
    detail: input.detail,
  };
}

export function createPlatformRunResult(input: {
  readonly flowId: PlatformFlowId;
  readonly trigger: PlatformOrchestrationTrigger;
  readonly memberRuns?: readonly PlatformMemberRun[];
  readonly memberDrafts?: readonly PlatformMemberDraft[];
  readonly statePatches?: readonly PlatformStatePatch[];
  readonly timelineEvents?: readonly PlatformTimelineEvent[];
  readonly nextActions?: readonly PlatformNextAction[];
  readonly userMessage?: string;
}): PlatformRunResult {
  return {
    flowId: input.flowId,
    trigger: input.trigger,
    memberRuns: input.memberRuns ?? [],
    memberDrafts: input.memberDrafts ?? [],
    statePatches: input.statePatches ?? [],
    timelineEvents: input.timelineEvents ?? [],
    nextActions: input.nextActions ?? [],
    userMessage: input.userMessage,
  };
}
