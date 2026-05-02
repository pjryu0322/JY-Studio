import { type RequirementsRoomStateV3, VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { getMessageTargets } from "@/lib/requirements/requirementsTargets";
import {
  problemInterviewStrictFilledCount,
  PROBLEM_INTERVIEW_SLOT_TOTAL,
  slotStrictlyFilled,
  type ProblemInterviewSlot,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";

export type RequirementsWorkspaceStage = "ideation" | "service-flow";

export function resolveRequirementsWorkspaceStage(rawStage: string): RequirementsWorkspaceStage {
  return rawStage === "service-flow" ? "service-flow" : "ideation";
}

const IDEATION_SEND_DEV = process.env.NODE_ENV !== "production";

/** `[ideation-send:…]` — 개발에서만 (요청된 이벤트 이름과 일치) */
export function ideationSendDevLog(event: string, detail?: string) {
  if (!IDEATION_SEND_DEV) return;
  console.log(`[ideation-send:${event}]${detail ? ` ${detail}` : ""}`);
}

/** 연속 전송·이중 핸들러에 대한 안전망(본래는 단일 경로로만 append 되어야 함). */
export function shouldSkipIdeationDuplicateAppend(params: {
  messages: readonly RequirementsMessage[];
  role: "user" | "ai";
  body: string;
  speakerId?: string;
  /** true면 가상 AI 기획자 턴만 동일 본문으로 간주 */
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
  messages: RequirementsRoomStateV3["requirementsConversation"]["messages"],
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

export type SessionUser = { id: string; email: string; name: string };

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
  if (prevStrict < PROBLEM_INTERVIEW_SLOT_TOTAL / 2 && nextStrict >= PROBLEM_INTERVIEW_SLOT_TOTAL / 2) return "아이디어 정리도가 절반을 넘었습니다.";
  return "";
}
