"use client";

import { useEffect, useMemo, useRef } from "react";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { workspaceAiEntryToastMessage } from "@/lib/ai-member/platformAiMembers";
import { workspaceAiEntryNoticeStorageKey } from "@/lib/ai-member/workspaceAiMemoryNamespace";

/**
 * 화면 진입 시 참여 AI별 1회 토스트 — 세션에 `projectId`+`memberId` 조합으로 중복 방지.
 * `memberIds`가 있으면 복수 AI에 순서대로 적용한다.
 */
export function useWorkspaceAiEntryNotice(params: {
  readonly projectId: string;
  /** 단일(하위 호환) */
  readonly memberId?: WorkspaceAiMemberId;
  /** 복수 참여 AI — 있으면 memberId보다 우선 */
  readonly memberIds?: readonly WorkspaceAiMemberId[];
  readonly enabled?: boolean;
  readonly onMessage: (message: string) => void;
}): void {
  const { projectId, memberId, memberIds, enabled = true, onMessage } = params;
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const flatIds = useMemo((): readonly WorkspaceAiMemberId[] => {
    if (memberIds?.length) return memberIds;
    if (memberId) return [memberId];
    return [];
  }, [memberId, memberIds]);

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid || !enabled || !flatIds.length) return;
    const lines: string[] = [];
    for (const mid of flatIds) {
      const msg = workspaceAiEntryToastMessage(mid);
      if (!msg) continue;
      const key = workspaceAiEntryNoticeStorageKey(pid, mid);
      try {
        if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) continue;
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, "1");
      } catch {
        continue;
      }
      lines.push(msg);
    }
    if (!lines.length) return;
    onMessageRef.current(lines.length === 1 ? lines[0]! : lines.join("\n"));
  }, [projectId, enabled, flatIds.join(",")]);
}
