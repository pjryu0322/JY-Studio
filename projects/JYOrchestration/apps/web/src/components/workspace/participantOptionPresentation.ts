import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";

function trunc(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** AI 전부 → 온라인 본인 → 기타 사람 (모달·사이드바 공통) */
export function sortParticipantsForPresenceList(participants: readonly ParticipantOption[]): ParticipantOption[] {
  const ais = participants.filter((p) => p.kind === "ai");
  const self = participants.filter((p) => p.kind === "human" && p.onlineHint);
  const others = participants.filter((p) => p.kind === "human" && !p.onlineHint);
  return [...ais, ...self, ...others];
}

export type ParticipantStatusSubtitleDensity = "modal" | "sidebar";

const SUBTITLE_LIMITS: Record<
  ParticipantStatusSubtitleDensity,
  { readonly prov: number; readonly current: number; readonly recent: number; readonly fallback: number }
> = {
  modal: { prov: 14, current: 40, recent: 44, fallback: 36 },
  sidebar: { prov: 14, current: 36, recent: 40, fallback: 32 },
};

/** 참여 멤버 행 메타 한 줄(제공자 · 상태/최근 작업 또는 사람 프레즌스) */
export function formatParticipantStatusSubtitle(p: ParticipantOption, density: ParticipantStatusSubtitleDensity): string {
  const L = SUBTITLE_LIMITS[density];
  const parts: string[] = [];
  if (p.kind === "ai") {
    const prov = p.aiExecutionProviderLabel?.trim();
    if (prov) parts.push(trunc(prov, L.prov));
    if (p.isCurrentScreenAi) {
      const s = p.aiStatusLabel?.trim();
      if (s) parts.push(trunc(s, L.current));
    } else {
      const r = p.aiRecentActivityLabel?.trim();
      if (r) parts.push(trunc(r, L.recent));
      else {
        const s = p.aiStatusLabel?.trim();
        if (s) parts.push(trunc(s, L.fallback));
      }
    }
    if (!parts.length) parts.push("AI");
  } else {
    const role = p.roleLabel?.trim();
    if (role) parts.push(role);
    if (p.invited) parts.push("초대됨");
    parts.push(p.onlineHint ? "온라인" : "오프라인");
  }
  return parts.join(" · ");
}
