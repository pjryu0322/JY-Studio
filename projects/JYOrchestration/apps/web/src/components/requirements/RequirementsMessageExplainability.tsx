"use client";

import { useMemo } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { buildMessageExplainabilityViewModel } from "@/lib/harness/explainability/buildMessageExplainabilityViewModel";
import { resolveMessageExplainabilityTraceWithConfidence } from "@/lib/harness/explainability/resolveMessageExplainabilityTrace";
import { MessageExplainabilityPanel } from "@/components/orchestration/explainability/MessageExplainabilityPanel";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { MESSAGE_EXPLAINABILITY_EMPTY_COPY } from "@/lib/overlay-ui/messageExplainabilityUiAdapter";

function explainabilityDebugEnabled(): boolean {
  return String(process.env.NEXT_PUBLIC_JY_EXPLAINABILITY_DEBUG ?? "").trim() === "1";
}

export function RequirementsMessageExplainability({
  message,
  promptTimeline,
  onOpenPromptTimeline,
}: {
  readonly message: RequirementsMessage;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly onOpenPromptTimeline?: () => void;
}) {
  const debug = explainabilityDebugEnabled();

  const resolution = useMemo(
    () =>
      resolveMessageExplainabilityTraceWithConfidence({
        message: {
          id: message.id,
          role: message.role,
          createdAt: message.createdAt,
          content: message.content,
          speakerId: message.speakerId,
          meta: message.meta,
        },
        promptTimeline: promptTimeline ?? null,
      }),
    [
      message.id,
      message.role,
      message.createdAt,
      message.content,
      message.speakerId,
      message.meta,
      promptTimeline,
    ]
  );

  const vm = useMemo(
    () => buildMessageExplainabilityViewModel({ overlayExtract: resolution.extract }),
    [resolution.extract]
  );

  if (message.role !== "ai") return null;

  const showPanel = resolution.confidence !== "none" && vm.hasData;

  if (!showPanel) {
    if (!debug) return null;
    return (
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
        <span style={{ fontWeight: 700 }}>[AI 판단 보기]</span> {MESSAGE_EXPLAINABILITY_EMPTY_COPY}
      </div>
    );
  }

  const timelineAvailable = Boolean(Array.isArray(promptTimeline) && promptTimeline.length > 0);

  return (
    <MessageExplainabilityPanel
      vm={vm}
      onOpenPromptTimeline={onOpenPromptTimeline}
      promptTimelineAvailable={timelineAvailable}
    />
  );
}
