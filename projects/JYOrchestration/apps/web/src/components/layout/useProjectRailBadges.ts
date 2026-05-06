"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  readProjectRailParticipantCounts,
  subscribeProjectRailParticipantCounts,
  type ProjectRailParticipantStepKey,
} from "@/lib/layout/projectRailParticipants";

function emptyParticipantSnapshot(): string {
  return "{}";
}

/**
 * 프로젝트 레일: 단계별 참여 수(세션 캐시 + 이벤트) 및 프로젝트 멤버 수(API).
 * 참여 수는 `useSyncExternalStore`로 sessionStorage·커스텀 이벤트와 동기화합니다.
 */
export function useProjectRailBadges(projectId: string | null): {
  readonly participantCounts: Partial<Record<ProjectRailParticipantStepKey, number>>;
  readonly memberCount: number;
} {
  const pid = projectId?.trim() ?? "";

  const participantSnapshot = useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        if (!pid) return () => {};
        return subscribeProjectRailParticipantCounts(pid, onStoreChange);
      },
      [pid]
    ),
    useCallback(() => {
      if (typeof window === "undefined" || !pid) return emptyParticipantSnapshot();
      return JSON.stringify(readProjectRailParticipantCounts(pid));
    }, [pid]),
    emptyParticipantSnapshot
  );

  const participantCounts = useMemo((): Partial<Record<ProjectRailParticipantStepKey, number>> => {
    try {
      const parsed = JSON.parse(participantSnapshot) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as Partial<Record<ProjectRailParticipantStepKey, number>>;
    } catch {
      return {};
    }
  }, [participantSnapshot]);

  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!pid) return;
    let cancelled = false;
    void (async () => {
      setMemberCount(0);
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

  return { participantCounts, memberCount: pid ? memberCount : 0 };
}
