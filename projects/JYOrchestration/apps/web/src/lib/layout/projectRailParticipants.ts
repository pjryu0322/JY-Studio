import type { AppFlowStepId } from "@/lib/workflow/flow-state";

/** 프로젝트 레일 단계 아이콘에 표시할 참여 수(화면별 캐시 키) */
export type ProjectRailParticipantStepKey = "requirements" | "service_flow" | "features" | "execution" | "prototype_review";

export const PROJECT_RAIL_PARTICIPANT_STEP_KEYS: readonly ProjectRailParticipantStepKey[] = [
  "requirements",
  "service_flow",
  "features",
  "execution",
  "prototype_review",
] as const;

/** `PlatformTopNav` 등이 구독 — 화면에서 참여 수가 바뀌면 레일 배지를 즉시 갱신 */
export const PROJECT_RAIL_PARTICIPANTS_EVENT = "jyo:rail:participants" as const;

export type ProjectRailParticipantsEventDetail = Readonly<{
  projectId: string;
  key: ProjectRailParticipantStepKey;
  count: number;
}>;

export function projectRailParticipantStorageKey(projectId: string, key: ProjectRailParticipantStepKey): string {
  return `jyo:rail:participants:${projectId.trim()}:${key}`;
}

/** 단계별 참여 수를 세션에 저장하고 레일에 브로드캐스트합니다. */
export function publishProjectRailParticipantCount(
  projectId: string,
  key: ProjectRailParticipantStepKey,
  count: number
): void {
  const pid = projectId.trim();
  if (!pid) return;
  const n = Math.max(0, Math.floor(Number(count)));
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(projectRailParticipantStorageKey(pid, key), String(n));
    }
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ProjectRailParticipantsEventDetail>(PROJECT_RAIL_PARTICIPANTS_EVENT, {
      detail: { projectId: pid, key, count: n },
    })
  );
}

export function readProjectRailParticipantCounts(projectId: string): Partial<Record<ProjectRailParticipantStepKey, number>> {
  const pid = projectId.trim();
  if (!pid || typeof sessionStorage === "undefined") return {};
  const next: Partial<Record<ProjectRailParticipantStepKey, number>> = {};
  for (const k of PROJECT_RAIL_PARTICIPANT_STEP_KEYS) {
    try {
      const v = sessionStorage.getItem(projectRailParticipantStorageKey(pid, k));
      const n = v ? Number(v) : 0;
      if (Number.isFinite(n)) next[k] = Math.max(0, Math.floor(n));
    } catch {
      /* ignore */
    }
  }
  return next;
}

export function appFlowStepIdToRailParticipantKey(stepId: AppFlowStepId): ProjectRailParticipantStepKey | null {
  switch (stepId) {
    case "requirements":
    case "service_flow":
    case "features":
    case "execution":
    case "prototype_review":
      return stepId;
    default:
      return null;
  }
}
