"use client";

import { useCallback, useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { CanvasArtifactType } from "@/lib/requirements/projectCanvasHub";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  activeFeatureDetailSlots,
  applyFeatureDetailSlotMutation,
  withFeatureDetailFocus,
  type FeatureDetailSlotEditDraft,
  type FeatureDetailSlotMutationMode,
  type FeatureDetailSlotsV1,
} from "@/lib/requirements/featureDetailSlots";
import {
  mergeRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
  type RequirementsServiceFlowV1,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";

export type UseFeatureDetailEditingArgs = {
  readonly stateJsonRef: MutableRefObject<RequirementsStateJson>;
  readonly persistedFeatureDetail: FeatureDetailSlotsV1 | null | undefined;
  readonly serviceFlow: RequirementsServiceFlowV1 | null;
  readonly persistStateJsonOnly: (patch: Partial<RequirementsStateJson>) => Promise<void>;
  readonly appendSingleChatPromptTimeline: (entry: RequirementsPromptTimelineEntry) => void;
  readonly setActiveCanvasView: Dispatch<SetStateAction<CanvasArtifactType | null>>;
  readonly showSuccessToast: (message: string) => void;
  readonly showErrorToast: (message: string) => void;
};

export function useFeatureDetailEditing(args: UseFeatureDetailEditingArgs) {
  const [editOpen, setEditOpen] = useState(false);
  const [editSlotId, setEditSlotId] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const resolveArtifact = useCallback((): FeatureDetailSlotsV1 | null => {
    void revision;
    return args.stateJsonRef.current.featureDetailSlotsV1 ?? args.persistedFeatureDetail ?? null;
  }, [args.persistedFeatureDetail, revision, args.stateJsonRef]);

  const appendMutationTimeline = useCallback(
    (artifact: FeatureDetailSlotsV1) => {
      const m = artifact.lastMutation;
      if (!m) return;
      args.appendSingleChatPromptTimeline({
        stage: "feature-planning",
        stageGroup: "service-planning",
        workspaceScreenKey: "feature_planning",
        action: "feature_detail_mutation",
        source: "internal",
        createdAt: m.at,
        routingDecision: m.featureAction,
        responseText: [
          `feature:${m.featureId ?? ""}`,
          `linkedStep:${m.linkedStepId ?? ""}`,
          `featureAction:${m.featureAction}`,
          m.previousStatus ? `previousStatus:${m.previousStatus}` : "",
          m.nextStatus ? `nextStatus:${m.nextStatus}` : "",
          `mutationSource:${m.mutationSource}`,
        ]
          .filter(Boolean)
          .join(" "),
      });
    },
    [args.appendSingleChatPromptTimeline],
  );

  const persistArtifact = useCallback(
    async (next: FeatureDetailSlotsV1) => {
      args.stateJsonRef.current = mergeRequirementsStateJson(args.stateJsonRef.current, {
        featureDetailSlotsV1: next,
      });
      await args.persistStateJsonOnly({ featureDetailSlotsV1: next });
      appendMutationTimeline(next);
      setRevision((n) => n + 1);
    },
    [args.stateJsonRef, args.persistStateJsonOnly, appendMutationTimeline],
  );

  const persistFocus = useCallback(
    async (artifact: FeatureDetailSlotsV1, featureId: string) => {
      const focused = withFeatureDetailFocus(artifact, featureId);
      if (focused.focusFeatureId === artifact.focusFeatureId) return;
      args.stateJsonRef.current = mergeRequirementsStateJson(args.stateJsonRef.current, {
        featureDetailSlotsV1: focused,
      });
      await args.persistStateJsonOnly({ featureDetailSlotsV1: focused });
      setRevision((n) => n + 1);
    },
    [args.stateJsonRef, args.persistStateJsonOnly],
  );

  const runMutation = useCallback(
    async (input: {
      readonly featureId: string;
      readonly mode: FeatureDetailSlotMutationMode;
      readonly draft?: FeatureDetailSlotEditDraft;
      readonly mutationSource: string;
    }) => {
      const artifact = resolveArtifact();
      if (!artifact) return { ok: false as const };
      setEditBusy(true);
      setConfirmError(null);
      try {
        const { artifact: next, error } = applyFeatureDetailSlotMutation({
          artifact,
          featureId: input.featureId,
          mode: input.mode,
          draft: input.draft,
          mutationSource: input.mutationSource,
        });
        if (error) {
          setConfirmError(error);
          return { ok: false as const, error };
        }
        await persistArtifact(next);
        if (input.mode === "obsolete" && editSlotId === input.featureId) {
          setEditOpen(false);
          setEditSlotId(null);
        }
        const toast =
          input.mode === "obsolete" ? "기능을 폐기했습니다."
          : input.mode === "partial" ? "기능을 부분 저장했습니다."
          : "기능을 확정했습니다.";
        args.showSuccessToast(toast);
        return { ok: true as const };
      } catch {
        args.showErrorToast(
          input.mode === "obsolete" ? "기능 폐기에 실패했습니다." : "기능 저장에 실패했습니다.",
        );
        return { ok: false as const };
      } finally {
        setEditBusy(false);
      }
    },
    [resolveArtifact, persistArtifact, editSlotId, args.showSuccessToast, args.showErrorToast],
  );

  const openEdit = useCallback(
    async (slotId?: string) => {
      const artifact = resolveArtifact();
      const active = artifact ? activeFeatureDetailSlots(artifact) : [];
      const target =
        slotId ??
        artifact?.focusFeatureId ??
        active.find((s) => s.status === "candidate" || s.status === "partial")?.id ??
        active[0]?.id ??
        null;
      args.setActiveCanvasView("feature-detail");
      if (!target || !artifact) return;
      await persistFocus(artifact, target);
      setEditSlotId(target);
      setConfirmError(null);
      setEditOpen(true);
    },
    [resolveArtifact, persistFocus, args.setActiveCanvasView],
  );

  const mutateFromCanvas = useCallback(
    async (slotId: string, mode: FeatureDetailSlotMutationMode) => {
      const result = await runMutation({
        featureId: slotId,
        mode,
        mutationSource: "feature_detail_canvas",
      });
      if (mode === "confirm" && !result.ok && result.error) {
        await openEdit(slotId);
      }
    },
    [runMutation, openEdit],
  );

  const handlePartialSave = useCallback(
    async (draft: FeatureDetailSlotEditDraft) => {
      if (!editSlotId) return;
      await runMutation({
        featureId: editSlotId,
        mode: "partial",
        draft,
        mutationSource: "feature_detail_edit_drawer",
      });
    },
    [editSlotId, runMutation],
  );

  const handleConfirm = useCallback(
    async (draft: FeatureDetailSlotEditDraft) => {
      if (!editSlotId) return;
      await runMutation({
        featureId: editSlotId,
        mode: "confirm",
        draft,
        mutationSource: "feature_detail_edit_drawer",
      });
    },
    [editSlotId, runMutation],
  );

  const handleObsolete = useCallback(async () => {
    if (!editSlotId) return;
    await runMutation({
      featureId: editSlotId,
      mode: "obsolete",
      mutationSource: "feature_detail_edit_drawer",
    });
  }, [editSlotId, runMutation]);

  const artifactLive = resolveArtifact();
  const editSlot = artifactLive?.slots.find((s) => s.id === editSlotId) ?? null;
  const navSlotIds = useMemo(
    () => activeFeatureDetailSlots(artifactLive).map((s) => s.id),
    [artifactLive],
  );
  const flowSteps = useMemo(() => {
    const hydrated = hydrateServiceFlowStepsFromAlternativePayload(
      args.serviceFlow ?? { createdAt: "", updatedAt: "", actors: [], steps: [] },
    );
    return [...(hydrated.steps ?? [])].sort((a, b) => a.order - b.order);
  }, [args.serviceFlow]);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setConfirmError(null);
  }, []);

  return {
    editOpen,
    editSlotId,
    editBusy,
    confirmError,
    artifactLive,
    editSlot,
    navSlotIds,
    flowSteps,
    openEdit,
    closeEdit,
    mutateFromCanvas,
    handlePartialSave,
    handleConfirm,
    handleObsolete,
  };
}
