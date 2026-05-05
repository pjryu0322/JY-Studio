"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkNoteChatSelectionBridge } from "@/components/worknote/WorkNoteChatSelectionBridge";
import { WORK_NOTE_PENDING_CHAT_STORAGE_KEY } from "@/components/worknote/workNotePendingChatKey";

/**
 * 워크스페이스(프로젝트) 안에서만 마운트됩니다. 채팅 선택 → 작업메모 스니펫을 저장하고 본문 라우트로 이동합니다.
 */
export function WorkNotePendingChatNav({ projectId }: { readonly projectId: string | null }) {
  const router = useRouter();
  const bridge = useWorkNoteChatSelectionBridge();
  const pid = projectId?.trim() ?? "";

  useEffect(() => {
    if (!bridge || !pid || bridge.projectId !== pid) return;
    bridge.registerWorkNoteAppendFromChat((text) => {
      try {
        sessionStorage.setItem(WORK_NOTE_PENDING_CHAT_STORAGE_KEY, text);
      } catch {
        /* ignore */
      }
      router.push(`/work-notes?projectId=${encodeURIComponent(pid)}`);
    });
    return () => bridge.registerWorkNoteAppendFromChat(null);
  }, [bridge, pid, router]);

  return null;
}
