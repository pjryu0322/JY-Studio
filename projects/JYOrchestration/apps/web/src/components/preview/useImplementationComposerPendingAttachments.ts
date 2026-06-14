"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImplementationComposerAttachment } from "@/lib/preview/implementationComposerAttachmentTypes";
import {
  composerAttachmentFromAttachMessage,
  isPreviewCaptureComposerAttachMessage,
} from "@/lib/prototype/previewCaptureSingleChatBridge";

export function useImplementationComposerPendingAttachments(input: {
  readonly projectId: string;
  readonly chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
  readonly onAttachmentStaged?: (message: string) => void;
}): Readonly<{
  readonly pendingAttachments: readonly ImplementationComposerAttachment[];
  readonly addPendingAttachment: (attachment: ImplementationComposerAttachment) => void;
  readonly removePendingAttachment: (attachmentId: string) => void;
  readonly clearPendingAttachments: () => void;
  readonly consumePendingAttachmentsForSend: () => readonly ImplementationComposerAttachment[];
}> {
  const [pendingAttachments, setPendingAttachments] = useState<readonly ImplementationComposerAttachment[]>([]);

  useEffect(() => {
    const pid = input.projectId.trim();
    if (!pid || typeof window === "undefined") return;

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isPreviewCaptureComposerAttachMessage(event.data)) return;
      if (event.data.projectId.trim() !== pid) return;
      if (event.data.stage !== "implementation") return;

      const attachment = composerAttachmentFromAttachMessage(event.data);
      setPendingAttachments((prev) => {
        const withoutDup = prev.filter((a) => a.id !== attachment.id);
        return [...withoutDup, attachment];
      });
      input.onAttachmentStaged?.(
        "Preview 캡처가 대화입력창에 추가되었습니다. 보완 내용을 입력한 뒤 전송해 주세요.",
      );
      window.setTimeout(() => input.chatInputRef.current?.focus(), 0);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [input.projectId, input.chatInputRef, input.onAttachmentStaged]);

  const addPendingAttachment = useCallback((attachment: ImplementationComposerAttachment) => {
    setPendingAttachments((prev) => {
      const withoutDup = prev.filter((a) => a.id !== attachment.id);
      return [...withoutDup, attachment];
    });
    window.setTimeout(() => input.chatInputRef.current?.focus(), 0);
  }, [input.chatInputRef]);

  const removePendingAttachment = useCallback((attachmentId: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }, []);

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments([]);
  }, []);

  const consumePendingAttachmentsForSend = useCallback(() => {
    let snapshot: readonly ImplementationComposerAttachment[] = [];
    setPendingAttachments((prev) => {
      snapshot = prev;
      return [];
    });
    return snapshot;
  }, []);

  return {
    pendingAttachments,
    addPendingAttachment,
    removePendingAttachment,
    clearPendingAttachments,
    consumePendingAttachmentsForSend,
  };
}

export { PREVIEW_REGION_CAPTURE_INTERNAL_TYPE } from "@/lib/prototype/previewCaptureSingleChatBridge";
