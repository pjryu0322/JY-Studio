"use client";

import { useCallback, type KeyboardEvent } from "react";

/** Enter 전송, Shift+Enter 줄바꿈(기본 채팅 composer 규약). */
export function useWorkspaceComposerEnterSend(opts: {
  readonly onSend: () => void;
  readonly disabled?: boolean;
  readonly busy?: boolean;
}) {
  const { onSend, disabled, busy } = opts;

  return useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      if (busy || disabled) return;
      onSend();
    },
    [busy, disabled, onSend],
  );
}
