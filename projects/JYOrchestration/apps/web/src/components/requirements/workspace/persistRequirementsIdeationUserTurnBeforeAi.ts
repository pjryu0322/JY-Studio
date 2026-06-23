import type { MutableRefObject } from "react";
import { patchRequirementsRoomConversationMessages } from "@/lib/project/requirementsRoomState";
import type { PersistRemoteFn } from "@/lib/requirements/requirementsWorkspacePersist";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import { buildPromptPresenterView } from "@/lib/requirements/promptPresenter";
import type { ProblemInterviewState } from "@/lib/requirements/problemInterview";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementMemberRef } from "@/lib/requirements/requirementsTargets";
import { restoreProblemInterviewSnapshotIfClearedInRef } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { VIRTUAL_AI_PLANNER_ID, type RequirementsRoomStateV3 } from "@/lib/project/requirementsRoomState";

/**
 * 아이디어 단계에서 사용자 메시지가 이미 `msgs`에 포함된 상태로, AI 호출 직전 원격 저장과
 * 프롬프트 메타·problemInterview 스냅샷 처리만 수행합니다.
 */
export async function persistRequirementsIdeationUserTurnBeforeAi(ctx: {
  readonly sendTraceId: string;
  readonly text: string;
  readonly room: RequirementsRoomStateV3;
  readonly resolvedProjectId: string;
  readonly msgs: readonly RequirementsMessage[];
  readonly targets: readonly RequirementMemberRef[];
  readonly ideationConversationOnly: readonly RequirementsMessage[];
  readonly projectName: string;
  readonly projectDescription: string;
  readonly isAiTarget: (targetId: string) => boolean;
  readonly stateJsonRef: MutableRefObject<RequirementsStateJson>;
  readonly persistRemote: PersistRemoteFn;
}): Promise<{ withCalling: RequirementsRoomStateV3; primaryId: string; aiName: string }> {
  const {
    sendTraceId,
    text,
    room,
    resolvedProjectId,
    msgs,
    targets,
    ideationConversationOnly,
    projectName,
    projectDescription,
    isAiTarget,
    stateJsonRef,
    persistRemote,
  } = ctx;

  const primaryAi = targets.find((t) => isAiTarget(t.id));
  const combinedLabel = targets.map((t) => t.name).join(" · ");
  const primaryId = primaryAi?.id ?? targets[0].id;
  const aiName = primaryId === VIRTUAL_AI_PLANNER_ID ? IDEATION_AI_DISPLAY_NAME : primaryAi?.name ?? targets[0].name;

  const promptMetaIso = new Date().toISOString();
  const pv = buildPromptPresenterView({
    projectName,
    projectDescription,
    targetName: combinedLabel,
    messages: ideationConversationOnly,
    latestUserMessage: text,
  });
  const withCalling = patchRequirementsRoomConversationMessages(room, resolvedProjectId, msgs);
  const problemInterviewSnapshot =
    (stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined) ?? null;
  await persistRemote(withCalling, {}, {
    lastPromptView: pv,
    lastPromptText: pv.copyText,
    lastPromptGeneratedAt: promptMetaIso,
    lastUserDraftText: "",
    ...(problemInterviewSnapshot ? { problemInterview: problemInterviewSnapshot } : {}),
  });
  restoreProblemInterviewSnapshotIfClearedInRef(stateJsonRef, problemInterviewSnapshot, sendTraceId);

  return { withCalling, primaryId, aiName };
}
