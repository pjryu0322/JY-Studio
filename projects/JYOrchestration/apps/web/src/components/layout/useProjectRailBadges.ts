"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { isWorkspaceAiMemberEnabled } from "@/lib/ai-member/platformAiMembers";
import {
  readProjectRailParticipantCounts,
  subscribeProjectRailParticipantCounts,
  type ProjectRailParticipantStepKey,
} from "@/lib/layout/projectRailParticipants";

function emptyParticipantSnapshot(): string {
  return "{}";
}

/**
 * 프로젝트 레일: 단계별 참여 수(세션 캐시 + 이벤트) 및 멤버 배지 수.
 * 멤버 배지 = 이해관계자(HUMAN) 수 + AI Agent 탭에 해당하는 활성 워크스페이스 AI 역할 수(메모 제외).
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
        const [membersRes, workspaceAiRes] = await Promise.all([
          fetch(`/api/project/members?projectId=${encodeURIComponent(pid)}`, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch(`/api/project/workspace-ai?projectId=${encodeURIComponent(pid)}`, {
            credentials: "include",
            cache: "no-store",
          }),
        ]);

        const membersJson = (await membersRes.json()) as {
          success?: boolean;
          data?: ReadonlyArray<{ memberType?: string }>;
        };
        const workspaceJson = (await workspaceAiRes.json()) as {
          success?: boolean;
          data?: { members?: ReadonlyArray<{ catalogKey: string; enabled: boolean }> };
        };

        if (cancelled) return;

        const rows =
          membersRes.ok && membersJson.success && Array.isArray(membersJson.data) ? membersJson.data : [];
        const humanCount = rows.filter((m) => String(m.memberType ?? "").toUpperCase() === "HUMAN").length;

        let aiAgentRoleCount = 0;
        const graphMembers = workspaceJson.data?.members;
        if (workspaceAiRes.ok && workspaceJson.success && Array.isArray(graphMembers)) {
          aiAgentRoleCount = graphMembers.filter(
            (m) =>
              m.enabled &&
              m.catalogKey !== "memo" &&
              isWorkspaceAiMemberEnabled(m.catalogKey as WorkspaceAiMemberId)
          ).length;
        } else {
          aiAgentRoleCount = rows.filter((m) => String(m.memberType ?? "").toUpperCase() === "AI").length;
        }

        setMemberCount(Math.max(0, humanCount + aiAgentRoleCount));
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
