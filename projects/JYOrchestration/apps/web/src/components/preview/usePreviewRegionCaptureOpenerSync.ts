"use client";

import { useEffect } from "react";
import { fetchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import {
  isPreviewRegionCaptureSentMessage,
  PREVIEW_REGION_CAPTURE_INTERNAL_TYPE,
} from "@/lib/prototype/previewCaptureSingleChatBridge";
import { readImplementationStageChatMessages } from "@/lib/prototype/implementationStageChatSnapshot";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export function usePreviewRegionCaptureOpenerSync(input: {
  readonly projectId: string;
  readonly requirementsStateJsonRef: React.MutableRefObject<unknown>;
  readonly onRequirementsStateJsonChange?: (next: unknown) => void;
  readonly applyPersistedMessages?: (messages: readonly import("@/lib/requirements/requirementsMessage").RequirementsMessage[]) => void;
}): void {
  useEffect(() => {
    const pid = input.projectId.trim();
    if (!pid || typeof window === "undefined") return;

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isPreviewRegionCaptureSentMessage(event.data)) return;
      if (event.data.projectId.trim() !== pid) return;

      void (async () => {
        const { res, json } = await fetchSpecWorkspaceRequest(pid);
        if (!res.ok || !json || typeof json !== "object") return;
        const envelope = json as Record<string, unknown>;
        const data = envelope.data;
        if (!data || typeof data !== "object") return;
        const project = (data as Record<string, unknown>).project;
        if (!project || typeof project !== "object") return;
        const stateRaw = (project as Record<string, unknown>).requirementsStateJson;
        const parsed = parseRequirementsStateJson(stateRaw);
        if (!parsed) return;
        input.requirementsStateJsonRef.current = parsed;
        input.onRequirementsStateJsonChange?.(parsed);
        const messages = readImplementationStageChatMessages(parsed);
        input.applyPersistedMessages?.(messages);
      })();
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [
    input.projectId,
    input.requirementsStateJsonRef,
    input.onRequirementsStateJsonChange,
    input.applyPersistedMessages,
  ]);
}

export { PREVIEW_REGION_CAPTURE_INTERNAL_TYPE };
