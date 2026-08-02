/**
 * Publish Workbench presentation — Snapshot-only (no gate recomputation).
 */
import type {
  PackWorkflowSnapshot,
} from "@/lib/workflow/pack-workflow-snapshot";
import type {
  WorkflowAction,
  WorkflowBlockingReason,
  WorkflowStepState,
} from "@/lib/workflow/pack-workflow-facts";
import type { PublishRecoveryMode } from "@/lib/workflow/publish-recovery";

export type PublishWorkbenchChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  state: WorkflowStepState;
};

export type PublishWorkbenchPresentation = {
  primaryLabel: string;
  summaryMessage: string;
  checklist: PublishWorkbenchChecklistItem[];
  showDecisionForm: boolean;
  showUnpublish: boolean;
  showRestore: boolean;
  showNewRevision: boolean;
  showNewRevisionBlocked: boolean;
  recoveryBadge: string | null;
  blockingReasons: WorkflowBlockingReason[];
};

function hasAction(actions: readonly WorkflowAction[], code: WorkflowAction): boolean {
  return actions.includes(code);
}

/**
 * Pure: derive workbench UI flags/labels from Snapshot (+ optional recoveryMode passthrough).
 * Does not re-evaluate canPublish / phases / quality.
 */
export function presentPublishWorkbenchFromSnapshot(input: {
  snapshot: PackWorkflowSnapshot;
  packStatus: string;
  recoveryMode?: PublishRecoveryMode | null;
  recoveryMessage?: string | null;
}): PublishWorkbenchPresentation {
  const { snapshot, packStatus } = input;
  const actions = snapshot.availableActions;
  const recoveryMode = input.recoveryMode ?? snapshot.recoveryMode ?? null;

  const showDecisionForm =
    hasAction(actions, "PUBLISH_FIRST_REVISION") && packStatus === "REVIEWING";
  const showUnpublish = hasAction(actions, "UNPUBLISH");
  const showRestore = hasAction(actions, "RESTORE_EXISTING_REVISION");
  const showNewRevision = hasAction(actions, "PUBLISH_NEW_REVISION");
  const showNewRevisionBlocked =
    packStatus === "DRAFT" &&
    recoveryMode === "PUBLISH_NEW_REVISION" &&
    !showNewRevision;

  const checklist: PublishWorkbenchChecklistItem[] = [
    {
      id: "receipt",
      label: snapshot.receipt.label,
      done: snapshot.receipt.state === "COMPLETED",
      state: snapshot.receipt.state,
    },
    {
      id: "knowledgeScope",
      label: snapshot.knowledgeScope.label,
      done: snapshot.knowledgeScope.state === "COMPLETED",
      state: snapshot.knowledgeScope.state,
    },
    {
      id: "generation",
      label: snapshot.generation.label,
      done: snapshot.generation.state === "COMPLETED",
      state: snapshot.generation.state,
    },
    {
      id: "correction",
      label: snapshot.correction.label,
      done: snapshot.correction.state === "COMPLETED",
      state: snapshot.correction.state,
    },
    {
      id: "serviceValidation",
      label: snapshot.serviceValidation.label,
      done: snapshot.serviceValidation.state === "COMPLETED",
      state: snapshot.serviceValidation.state,
    },
    {
      id: "provider",
      label: "제공자 검토",
      done: !snapshot.blockingReasons.some(
        (r) =>
          r.code === "PROVIDER_REVIEW_REQUIRED" || r.code === "PROVIDER_REVIEW_STALE",
      ),
      state: snapshot.blockingReasons.some(
        (r) =>
          r.code === "PROVIDER_REVIEW_REQUIRED" || r.code === "PROVIDER_REVIEW_STALE",
      )
        ? "BLOCKED"
        : showDecisionForm || showNewRevision || showUnpublish
          ? "COMPLETED"
          : "AVAILABLE",
    },
    {
      id: "publish",
      label: snapshot.publish.label,
      done: snapshot.publish.state === "COMPLETED",
      state: snapshot.publish.state,
    },
  ];

  const recoveryBadge =
    showRestore
      ? "기존 게시본 복구 가능"
      : showNewRevision || showNewRevisionBlocked
        ? "새 Revision 게시 필요"
        : null;

  let primaryLabel = "게시 준비 중";
  if (showUnpublish) primaryLabel = "게시됨";
  else if (showRestore) primaryLabel = "기존 게시본 복구 가능";
  else if (showNewRevision) primaryLabel = "새 Revision 게시 가능";
  else if (showDecisionForm) primaryLabel = "승인·게시 가능";
  else if (snapshot.blockingReasons[0]) primaryLabel = "게시 차단";
  else if (snapshot.publish.state === "IN_PROGRESS") primaryLabel = "게시 단계";

  const summaryMessage =
    input.recoveryMessage?.trim() ||
    snapshot.blockingReasons[0]?.message ||
    (showDecisionForm
      ? "게시 조건을 충족했습니다."
      : "Snapshot blockingReasons / availableActions 기준입니다.");

  return {
    primaryLabel,
    summaryMessage,
    checklist,
    showDecisionForm,
    showUnpublish,
    showRestore,
    showNewRevision,
    showNewRevisionBlocked,
    recoveryBadge,
    blockingReasons: snapshot.blockingReasons,
  };
}
