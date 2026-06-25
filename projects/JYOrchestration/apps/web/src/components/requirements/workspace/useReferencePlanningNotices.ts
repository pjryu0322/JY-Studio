import { useEffect } from "react";
import type { Project } from "@prisma/client";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import {
  newChatMessage,
  patchRequirementsRoomConversationMessages,
  VIRTUAL_AI_PLANNER_ID,
  type RequirementsRoomStateV3,
} from "@/lib/project/requirementsRoomState";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { isProjectSeededFromPreProjectChat } from "@/lib/requirements/preProjectPlanningSummary";
import { shouldRegeneratePlanningSummaryAfterConversationReset } from "@/lib/requirements/preProjectPlanningSummary";
import { resolveReferencePlanningNoticeCandidate } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningNotice";

export type UseReferencePlanningNoticesInput = Readonly<{
  readonly conversationStatus: string;
  readonly resolvedProjectId: string;
  readonly loadedConversationProjectId: string;
  readonly project: Project | null | undefined;
  readonly room: RequirementsRoomStateV3;
  readonly onboardingAppliedKey: string;
  readonly onboardingKey: string;
  readonly conversationResetNonce: number;
  readonly consumedResetSeedNonce: number | null;
  readonly persistRemote: (
    nextRoom: RequirementsRoomStateV3,
    spec: Record<string, unknown>,
    meta: Partial<ReturnType<typeof parseRequirementsStateJson>>,
  ) => Promise<unknown>;
}>;

/** Inserts legacy-missing or reference welcome notices once per conversation (before other onboarding). */
export function useReferencePlanningNotices(input: UseReferencePlanningNoticesInput): void {
  useEffect(() => {
    if (input.conversationStatus !== "loaded") return;
    const pid = input.resolvedProjectId.trim();
    if (!pid) return;
    if (!input.project) return;
    if (input.loadedConversationProjectId !== pid) return;

    const workspaceState = parseRequirementsStateJson(input.project.requirementsStateJson);
    const seededFromPreProject = isProjectSeededFromPreProjectChat(workspaceState);
    const forceRegeneratePlanningSummary = shouldRegeneratePlanningSummaryAfterConversationReset({
      resetNonce: input.conversationResetNonce,
      consumedResetNonce: input.consumedResetSeedNonce,
      seededFromPreProject,
    });

    if (!forceRegeneratePlanningSummary && input.onboardingAppliedKey === input.onboardingKey) return;

    const existing = input.room.requirementsConversation.messages;
    const referenceNotice = resolveReferencePlanningNoticeCandidate({
      workspaceState,
      existingMessages: existing,
      nowIso: new Date().toISOString(),
    });
    if (!referenceNotice) return;

    void (async () => {
      const nextRoom = patchRequirementsRoomConversationMessages(input.room, pid, [
        newChatMessage({
          role: "ai",
          body: referenceNotice.body,
          speakerType: "AI",
          speakerId: VIRTUAL_AI_PLANNER_ID,
          speakerName: IDEATION_AI_DISPLAY_NAME,
          messageType: "NOTICE",
          meta: referenceNotice.meta,
        }),
      ]);
      await input.persistRemote(nextRoom, {}, referenceNotice.patchState);
    })();
  }, [
    input.conversationStatus,
    input.resolvedProjectId,
    input.loadedConversationProjectId,
    input.project,
    input.room,
    input.onboardingAppliedKey,
    input.onboardingKey,
    input.conversationResetNonce,
    input.consumedResetSeedNonce,
    input.persistRemote,
  ]);
}
