import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import {
  newChatMessage,
  patchRequirementsRoomConversationMessages,
  VIRTUAL_AI_PLANNER_ID,
  type RequirementsRoomStateV3,
} from "@/lib/project/requirementsRoomState";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  buildReferenceClearSelectionApiPath,
  buildReferenceInfoViewBodyFromState,
  clearReferenceSelectionStatePatch,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";
import { postReferencePrepareContextForProject } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializeClient";
import {
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_CONTINUE,
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
  REFERENCE_PLANNING_CHIP_VIEW,
  REFERENCE_PLANNING_CLEAR_NOTICE_BODY,
  REFERENCE_PLANNING_CLEAR_NOTICE_INTERNAL_TYPE,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_INTERNAL_TYPE,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_TOAST,
  REFERENCE_PLANNING_INFO_VIEW_INTERNAL_TYPE,
  buildReferencePlanningContextPrepareSuccessMessageMeta,
  isReferencePlanningChipLabel,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";

export type ReferencePlanningActionResult = Readonly<{ readonly handled: boolean }>;

export type UseReferencePlanningActionsInput = Readonly<{
  readonly projectId: string;
  readonly room: RequirementsRoomStateV3;
  readonly stateJsonRef: MutableRefObject<RequirementsStateJson>;
  readonly persistStateJsonOnly: (patch: Partial<RequirementsStateJson>) => Promise<boolean>;
  readonly persistRemote: (
    nextRoom: RequirementsRoomStateV3,
    conversationPatch: Record<string, unknown>,
    statePatch: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly setFetchNonce: Dispatch<SetStateAction<number>>;
  readonly showSuccessToast: (message: string) => void;
  readonly showErrorToast: (message: string) => void;
}>;

function appendReferenceAiNotice(
  room: RequirementsRoomStateV3,
  projectId: string,
  body: string,
  meta: Record<string, unknown>,
) {
  return patchRequirementsRoomConversationMessages(room, projectId, [
    newChatMessage({
      role: "ai",
      body,
      speakerType: "AI",
      speakerId: VIRTUAL_AI_PLANNER_ID,
      speakerName: IDEATION_AI_DISPLAY_NAME,
      messageType: "NOTICE",
      meta,
    }),
  ]);
}

export function useReferencePlanningActions(input: UseReferencePlanningActionsInput) {
  const handleReferencePlanningChip = useCallback(
    (label: string): ReferencePlanningActionResult => {
      const trimmed = String(label ?? "").trim();
      if (!isReferencePlanningChipLabel(trimmed)) {
        return { handled: false };
      }

      const pid = String(input.projectId ?? "").trim();
      if (!pid) return { handled: true };

      if (trimmed === REFERENCE_PLANNING_CHIP_CLEAR) {
        void (async () => {
          try {
            const res = await fetch(buildReferenceClearSelectionApiPath(pid), {
              method: "DELETE",
              credentials: "include",
            });
            const json = (await res.json()) as { success?: boolean; message?: string };
            if (!res.ok || !json.success) {
              input.showErrorToast(json.message ?? "참조 해제에 실패했습니다.");
              return;
            }
            const cleared = await input.persistStateJsonOnly(clearReferenceSelectionStatePatch());
            if (!cleared) {
              input.showErrorToast("참조 해제 상태 저장에 실패했습니다.");
              return;
            }
            const nextRoom = appendReferenceAiNotice(
              input.room,
              pid,
              REFERENCE_PLANNING_CLEAR_NOTICE_BODY,
              { internalType: REFERENCE_PLANNING_CLEAR_NOTICE_INTERNAL_TYPE },
            );
            await input.persistRemote(nextRoom, {}, {});
          } catch {
            input.showErrorToast("참조 해제에 실패했습니다.");
          }
        })();
        return { handled: true };
      }

      if (trimmed === REFERENCE_PLANNING_CHIP_VIEW) {
        const viewBody = buildReferenceInfoViewBodyFromState(input.stateJsonRef.current);
        if (!viewBody) {
          input.showErrorToast("표시할 참조 정보가 없습니다.");
          return { handled: true };
        }
        void (async () => {
          const nextRoom = appendReferenceAiNotice(input.room, pid, viewBody, {
            internalType: REFERENCE_PLANNING_INFO_VIEW_INTERNAL_TYPE,
          });
          await input.persistRemote(nextRoom, {}, {});
        })();
        return { handled: true };
      }

      if (trimmed === REFERENCE_PLANNING_CHIP_CONTINUE) {
        return { handled: true };
      }

      if (trimmed === REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT) {
        void (async () => {
          try {
            const outcome = await postReferencePrepareContextForProject(pid);
            if (outcome.ok) {
              input.setFetchNonce((n) => n + 1);
              const nextRoom = appendReferenceAiNotice(
                input.room,
                pid,
                REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY,
                buildReferencePlanningContextPrepareSuccessMessageMeta(),
              );
              await input.persistRemote(nextRoom, {}, {});
              input.showSuccessToast(REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_TOAST);
              return;
            }
            const nextRoom = appendReferenceAiNotice(input.room, pid, outcome.noticeBody, {
              internalType: REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_INTERNAL_TYPE,
              interviewSuggestions:
                outcome.failureNoticeChips.length > 0 ? [...outcome.failureNoticeChips] : undefined,
            });
            await input.persistRemote(nextRoom, {}, {});
            input.showErrorToast(
              outcome.noticeBody.split("\n")[0] ?? "참조 컨텍스트 준비에 실패했습니다.",
            );
          } catch {
            input.showErrorToast("참조 컨텍스트 준비에 실패했습니다.");
          }
        })();
        return { handled: true };
      }

      return { handled: true };
    },
    [input],
  );

  return { handleReferencePlanningChip };
}
