"use client";

import { useEffect, useState } from "react";
import {
  PROJECT_RAIL_PARTICIPANTS_EVENT,
  type ProjectRailParticipantStepKey,
  readProjectRailParticipantCounts,
  type ProjectRailParticipantsEventDetail,
} from "@/lib/layout/projectRailParticipants";

/**
 * 프로젝트 레일: 단계별 참여 수(세션 캐시 + 이벤트) 및 프로젝트 멤버 수(API).
 */
export function useProjectRailBadges(projectId: string | null): {
  readonly participantCounts: Partial<Record<ProjectRailParticipantStepKey, number>>;
  readonly memberCount: number;
} {
  const [participantCounts, setParticipantCounts] = useState<Partial<Record<ProjectRailParticipantStepKey, number>>>({});
  const [memberCount, setMemberCount] = useState(0);

  const pid = projectId?.trim() ?? "";

  useEffect(() => {
    if (!pid) {
      setParticipantCounts({});
      return;
    }
    setParticipantCounts(readProjectRailParticipantCounts(pid));
  }, [pid]);

  useEffect(() => {
    if (!pid) return;
    function onRailParticipants(e: Event) {
      const ce = e as CustomEvent<ProjectRailParticipantsEventDetail>;
      const d = ce.detail;
      if (!d || String(d.projectId ?? "").trim() !== pid) return;
      const k = d.key;
      const n = Number(d.count ?? 0);
      if (!Number.isFinite(n)) return;
      setParticipantCounts((prev) => ({ ...prev, [k]: Math.max(0, Math.floor(n)) }));
    }
    window.addEventListener(PROJECT_RAIL_PARTICIPANTS_EVENT, onRailParticipants);
    return () => window.removeEventListener(PROJECT_RAIL_PARTICIPANTS_EVENT, onRailParticipants);
  }, [pid]);

  useEffect(() => {
    if (!pid) {
      setMemberCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/project/members?projectId=${encodeURIComponent(pid)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json()) as { success?: boolean; data?: unknown[] };
        if (cancelled) return;
        const n = res.ok && json.success && Array.isArray(json.data) ? json.data.length : 0;
        setMemberCount(Math.max(0, n));
      } catch {
        if (!cancelled) setMemberCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pid]);

  return { participantCounts, memberCount };
}
