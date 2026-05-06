"use client";

import { FeaturePlanningWorkspace } from "@/components/feature-planning/FeaturePlanningWorkspace";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";

/**
 * Embeds the full 기능 정리 워크스페이스 inside `/requirements?stage=feature-planning`.
 * TODO: If nested `WorkspaceShell` + 상단 크롬이 과해지면, 쉘 없는 뷰 모드만 FeaturePlanningWorkspace에 추가해 정리합니다.
 */
export function RequirementsFeaturePlanningStagePanel({
  projectId,
  singleChatSendRef,
  onSingleChatAiMessages,
}: {
  readonly projectId: string;
  readonly singleChatSendRef?: { current: ((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>) | null };
  readonly onSingleChatAiMessages?: (messages: readonly { content: string; speakerName?: string }[]) => void | Promise<void>;
}) {
  return (
    <FeaturePlanningWorkspace
      projectId={projectId}
      singleChatMode
      singleChatSendRef={singleChatSendRef}
      onSingleChatAiMessages={onSingleChatAiMessages}
    />
  );
}
