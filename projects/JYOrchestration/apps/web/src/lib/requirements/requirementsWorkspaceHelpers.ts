import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { getMessageTargets } from "@/lib/requirements/requirementsTargets";
import {
  problemInterviewStrictFilledCount,
  PROBLEM_INTERVIEW_SLOT_TOTAL,
  slotStrictlyFilled,
  type ProblemInterviewSlot,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";
import { emptyProblemInterviewState } from "@/lib/requirements/problemInterview";
import { mergeRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  clearDerivedImplementationStateFromRequirementsJson,
  IMPLEMENTATION_SESSION_RESET_NULL_PATCH,
} from "@/lib/requirements/resetDerivedImplementationState";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { SingleChatOrchestrationStatusCounts } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";

export type RequirementsWorkspaceStage = "ideation" | "service-flow" | "feature-planning" | "implementation";

const IDEATION_SEND_DEV = process.env.NODE_ENV !== "production";

/** `[ideation-send:…]` — 개발에서만 (요청된 이벤트 이름과 일치) */
export function ideationSendDevLog(event: string, detail?: string) {
  if (!IDEATION_SEND_DEV) return;
  console.log(`[ideation-send:${event}]${detail ? ` ${detail}` : ""}`);
}

/**
 * persist 직후 `stateJsonRef`의 problemInterview가 비어 있으면, 저장 전 스냅샷으로 되살립니다.
 * (원격 응답이 상태 JSON에서 해당 필드를 누락시키는 경우의 클라이언트 보정.)
 */
export function restoreProblemInterviewSnapshotIfClearedInRef(
  stateJsonHolder: { current: RequirementsStateJson },
  snapshot: ProblemInterviewState | null | undefined,
  sendTraceId: string
): void {
  if (!snapshot) return;
  const piAfter = stateJsonHolder.current.problemInterview as ProblemInterviewState | null | undefined;
  if (piAfter !== undefined && piAfter !== null) return;
  stateJsonHolder.current = mergeRequirementsStateJson(stateJsonHolder.current, {
    problemInterview: snapshot,
  });
  ideationSendDevLog("problemInterview-restored", `id=${sendTraceId}`);
}

/** 연속 전송·이중 핸들러에 대한 안전망(본래는 단일 경로로만 append 되어야 함). */
export function shouldSkipIdeationDuplicateAppend(params: {
  messages: readonly RequirementsMessage[];
  role: "user" | "ai";
  body: string;
  speakerId?: string;
  /** true면 가상 AI(planner) 턴만 동일 본문으로 간주 */
  matchVirtualPlannerAi?: boolean;
}): boolean {
  const { messages, role, body, speakerId, matchVirtualPlannerAi } = params;
  const norm = String(body ?? "").trim();
  if (!norm) return false;
  const windowMs = 10_000;
  const now = Date.now();
  const tail = messages.slice(-5);
  for (let i = tail.length - 1; i >= 0; i--) {
    const m = tail[i]!;
    if (m.role !== role) continue;
    const t = String(m.content ?? "").trim();
    if (t !== norm) continue;
    const created = Date.parse(String(m.createdAt ?? ""));
    if (!Number.isFinite(created) || now - created > windowMs) continue;
    if (role === "user" && speakerId && String(m.speakerId) !== String(speakerId)) continue;
    if (role === "ai" && matchVirtualPlannerAi && m.speakerId !== VIRTUAL_AI_PLANNER_ID) continue;
    return true;
  }
  return false;
}

export function formatDialogueExcerpt(
  messages: readonly RequirementsMessage[],
  maxChars = 12000
): string {
  const lines = messages.slice(-48).map((m) => {
    const who =
      m.role === "user"
        ? "사용자"
        : m.role === "ai"
          ? `AI${m.speakerName ? `(${m.speakerName})` : ""}`
          : m.role === "human"
            ? `멤버${m.speakerName ? `(${m.speakerName})` : ""}`
            : "시스템";
    const tg = getMessageTargets(m);
    const arrow = tg.length ? ` → ${tg.map((t) => t.name).join(", ")}` : "";
    return `${who}${arrow}: ${m.content}`;
  });
  return lines.join("\n").slice(-maxChars);
}

export type MemberRow = {
  memberId: string;
  displayName: string | null;
  email: string | null;
  memberType: string;
  role: string;
  isOwner?: boolean;
  userId?: string | null;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
};

export type SessionUser = { id: string; email: string; name: string; avatarUrl?: string | null };

export const IDEATION_DRAFT_MIN_FILLED_SLOTS = 5;
export const IDEATION_DRAFT_REQUIRED_SLOTS: readonly ProblemInterviewSlot[] = [
  "serviceIdea",
  "targetUser",
  "coreProblem",
  "expectedOutcome",
] as const;

export function ideationDraftGateStatus(state: ProblemInterviewState | null | undefined) {
  const strictFilled = problemInterviewStrictFilledCount(state);
  const requiredCovered = Boolean(state && IDEATION_DRAFT_REQUIRED_SLOTS.every((slot) => slotStrictlyFilled(state, slot)));
  return {
    strictFilled,
    requiredCovered,
    ready: strictFilled >= IDEATION_DRAFT_MIN_FILLED_SLOTS && requiredCovered,
  };
}

export function ideationInterviewMilestoneLine(
  prev: ProblemInterviewState | null | undefined,
  next: ProblemInterviewState | null | undefined
): string {
  const prevStrict = problemInterviewStrictFilledCount(prev);
  const nextStrict = problemInterviewStrictFilledCount(next);
  const prevReady = ideationDraftGateStatus(prev).ready;
  const nextReady = ideationDraftGateStatus(next).ready;
  if (!prevReady && nextReady) return "정리 요청 가능 상태입니다.";
  if (prevStrict < PROBLEM_INTERVIEW_SLOT_TOTAL && nextStrict >= PROBLEM_INTERVIEW_SLOT_TOTAL) return "필요한 핵심 정보가 모두 모였습니다.";
  if (prevStrict < PROBLEM_INTERVIEW_SLOT_TOTAL - 1 && nextStrict >= PROBLEM_INTERVIEW_SLOT_TOTAL - 1) return "마지막 정보 1개만 더 확인하겠습니다.";
  if (prevStrict < PROBLEM_INTERVIEW_SLOT_TOTAL / 2 && nextStrict >= PROBLEM_INTERVIEW_SLOT_TOTAL / 2)
    return "서비스 정의 진행도가 절반을 넘었습니다.";
  return "";
}

/**
 * In-memory `stateJsonRef` wins over persisted project JSON when the key is present
 * (e.g. conversation reset clears orchestration before the project refetch).
 */
export function resolveWorkspaceSingleChatOrchestration(input: {
  readonly localState: RequirementsStateJson;
  readonly persistedOrchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly slotDefinitionsHash: string;
}): RequirementsSingleChatOrchestrationStateV1 | null {
  const useLocal = Object.prototype.hasOwnProperty.call(input.localState, "singleChatOrchestrationV1");
  const orch = useLocal
    ? (input.localState.singleChatOrchestrationV1 ?? null)
    : (input.persistedOrchestration ?? null);
  if (!orch || orch.slotDefinitionsHash !== input.slotDefinitionsHash) return null;
  return orch;
}

/** 오케스트레이션 0%·슬롯 미확보 초기 상태에서는 Hub 알림 배지를 숨깁니다. */
export function shouldShowWorkspaceHubNotificationBadges(input: {
  readonly readinessPercent: number;
  readonly statusCounts: SingleChatOrchestrationStatusCounts | null | undefined;
}): boolean {
  if (input.readinessPercent > 0) return true;
  const c = input.statusCounts;
  if (!c) return false;
  return c.confirmed + c.partial + c.candidate > 0;
}

/** 기획 허브 「대화 초기화」— 대화·슬롯·산출물·흐름 등 초기화 대상이 하나라도 있으면 true */
export function planningWorkspaceHasResettableContent(input: {
  readonly messageCount: number;
  readonly state: RequirementsStateJson;
}): boolean {
  if (input.messageCount > 0) return true;
  const s = input.state;
  if ((s.deliverableAssets ?? []).length > 0) return true;
  if ((s.projectArtifacts ?? []).length > 0) return true;
  if (s.serviceFlowV1 != null) return true;
  if (s.singleChatOrchestrationV1 != null) return true;
  if (s.featurePlanningSlotsV1 != null) return true;
  if (s.featureDetailSlotsV1 != null) return true;
  if (s.fastPlanDraftV1 != null) return true;
  if (s.fastPlanGenerationV1 != null) return true;
  if ((s.promptTimeline ?? []).length > 0) return true;
  const pi = s.problemInterview;
  if (pi && problemInterviewStrictFilledCount(pi) > 0) return true;
  return false;
}

/**
 * 대화 초기화 — 서비스 기획 세션(산출물·Canvas·슬롯·흐름)을 비우고 프로젝트 메타만 유지.
 */
export function buildRequirementsConversationResetStateJson(
  base: RequirementsStateJson,
  nowIso: string,
): RequirementsStateJson {
  const planningCleared: RequirementsStateJson = {
    originalProjectDescription: base.originalProjectDescription ?? null,
    seededFromPreProjectChat: base.seededFromPreProjectChat,
    openIssues: base.openIssues,
    priorityFeatures: base.priorityFeatures,
    onboardingShown: false,
    selectedTargetId: null,
    selectedMembers: null,
    problemInterview: emptyProblemInterviewState(nowIso),
    problemInterviewHistory: null,
    globalDelegation: false,
    serviceFlowV1: null,
    deliverableAssets: [],
    projectArtifacts: [],
    organizeContext: null,
    organizePlannerState: null,
    featurePlanningSlotsV1: null,
    featureDetailSlotsV1: null,
    featurePlanningWorkspaceChatV1: null,
    fastPlanGenerationV1: null,
    fastPlanDraftV1: null,
    singleChatOrchestrationV1: null,
    requirementsOrchestrationStageV1: null,
    requirementsIntentOrchestrationV1: null,
    artifactOrchestrationV1: null,
    promptTimeline: [],
    lastUserDraftText: "",
    lastPromptView: null,
  };
  return clearDerivedImplementationStateFromRequirementsJson(planningCleared, {
    nowIso,
    appendPlanningResetTrace: true,
    nullSingleChat: true,
    clearExecutionLog: true,
    clearRuntimeState: true,
  });
}

/**
 * 구현 단계 대화 초기화 — 구현 SingleChat·작업안·Seed·WIP·타임라인 카드를 비우고 기획 산출물·슬롯은 유지.
 */
export function buildImplementationConversationResetStateJson(
  base: RequirementsStateJson,
  nowIso: string,
): RequirementsStateJson {
  return {
    ...clearDerivedImplementationStateFromRequirementsJson(
      {
        ...base,
        promptTimeline: [],
        lastSavedAt: nowIso,
      },
      { nullSingleChat: true, clearExecutionLog: true, clearRuntimeState: true },
    ),
    ...IMPLEMENTATION_SESSION_RESET_NULL_PATCH,
    promptTimeline: [],
  };
}

/** `stateJsonRef`에 키가 있으면(빈 배열 포함) 로컬 값을 우선 — 대화 초기화 직후 서버 JSON 폴백 방지 */
export function resolveWorkspaceDeliverableAssets(input: {
  readonly localState: RequirementsStateJson;
  readonly persisted: readonly IdeationDeliverableAsset[] | null | undefined;
}): readonly IdeationDeliverableAsset[] {
  if (Object.prototype.hasOwnProperty.call(input.localState, "deliverableAssets")) {
    return input.localState.deliverableAssets ?? [];
  }
  return input.persisted ?? [];
}

export function resolveWorkspaceProjectArtifacts(input: {
  readonly localState: RequirementsStateJson;
  readonly persisted: readonly ProjectArtifact[] | null | undefined;
}): readonly ProjectArtifact[] {
  if (Object.prototype.hasOwnProperty.call(input.localState, "projectArtifacts")) {
    return input.localState.projectArtifacts ?? [];
  }
  return input.persisted ?? [];
}
