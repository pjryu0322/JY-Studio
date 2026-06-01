"use client";

import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Project } from "@/components/project-spec/types";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import { joinSuccessCriteriaAndNfr, splitSuccessCriteriaAndNfr } from "@/lib/project/requirementsSuccessCriteriaSplit";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
  type RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import type { RequirementsRoomStateV3 } from "@/lib/project/requirementsRoomState";
import type { SpecWorkspaceProjectPatchResponseBody } from "@/lib/types/specWorkspaceProjectPatch";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import { notifyAppFlowProjectContextRefresh } from "@/lib/workflow/appFlowModel";
import { writeLocalShell } from "@/components/requirements/workspace/requirementsLocalShell";
import type { RequirementsSaveState } from "@/components/requirements/workspace/useRequirementsSaveToast";

export type RequirementsSpecWorkspacePersistArgs = {
  readonly resolvedProjectId: string;
  readonly stateJsonRef: MutableRefObject<RequirementsStateJson>;
  readonly setSaveState: Dispatch<SetStateAction<RequirementsSaveState>>;
  readonly setLastSavedAt: Dispatch<SetStateAction<string | null>>;
  readonly setProject: Dispatch<SetStateAction<Project | null>>;
  readonly setServiceFlow: Dispatch<SetStateAction<RequirementsServiceFlowV1 | null>>;
  readonly setRoom: Dispatch<SetStateAction<RequirementsRoomStateV3>>;
  readonly goals: string;
  readonly scopeIn: string;
  readonly scopeOut: string;
  readonly targetUsers: string;
  readonly success: string;
  readonly nfr: string;
  readonly openIssues: string;
  readonly priorityFeatures: string;
  readonly organizedAt: string | null;
  readonly onboardingAppliedKey: string | null;
  readonly onboardingKey: string;
};

export function useRequirementsSpecWorkspacePersist(args: RequirementsSpecWorkspacePersistArgs) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const persistStateJsonOnly = useCallback(async (patch: Partial<RequirementsStateJson>): Promise<boolean> => {
    const {
      resolvedProjectId,
      stateJsonRef,
      setSaveState,
      setProject,
      setLastSavedAt,
    } = argsRef.current;
    const pid = resolvedProjectId.trim();
    if (!pid) return false;
    const ts = new Date().toISOString();
    const merged = mergeRequirementsStateJson(stateJsonRef.current, { ...patch, lastSavedAt: patch.lastSavedAt ?? ts });
    stateJsonRef.current = merged;
    setSaveState("saving");
    try {
      const { res, json: raw } = await patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged });
      const json = raw as SpecWorkspaceProjectPatchResponseBody;
      if (!res.ok || !json.success || !json.data?.project) {
        setSaveState("error");
        return false;
      }
      if (json.data.patchApplied === false) {
        setSaveState("error");
        return false;
      }
      setProject(json.data.project);
      stateJsonRef.current = parseRequirementsStateJson(json.data.project.requirementsStateJson);
      notifyAppFlowProjectContextRefresh();
      setSaveState("saved");
      setLastSavedAt(merged.lastSavedAt ?? ts);
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }, []);

  const persistServiceFlow = useCallback(async (next: RequirementsServiceFlowV1 | null) => {
    argsRef.current.setServiceFlow(next);
    await persistStateJsonOnly({ serviceFlowV1: next });
  }, [persistStateJsonOnly]);

  const persistRemote = useCallback(
    async (nextRoom: RequirementsRoomStateV3, spec: Partial<Project>, meta?: Partial<RequirementsStateJson>) => {
      const {
        resolvedProjectId,
        stateJsonRef,
        setSaveState,
        setProject,
        setLastSavedAt,
        setRoom,
        goals,
        scopeIn,
        scopeOut,
        targetUsers,
        success,
        nfr,
        openIssues,
        priorityFeatures,
        organizedAt,
        onboardingAppliedKey,
        onboardingKey,
      } = argsRef.current;
      const pid = resolvedProjectId.trim();
      setRoom(nextRoom);
      if (!pid) {
        if (meta) {
          stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, meta);
        }
        const g = spec.specCoreGoals !== undefined ? String(spec.specCoreGoals ?? "") : goals;
        const si = spec.specScopeIn !== undefined ? String(spec.specScopeIn ?? "") : scopeIn;
        const so = spec.specScopeOut !== undefined ? String(spec.specScopeOut ?? "") : scopeOut;
        const tu = spec.specTargetUsers !== undefined ? String(spec.specTargetUsers ?? "") : targetUsers;
        const sc = spec.specSuccessCriteria !== undefined ? String(spec.specSuccessCriteria ?? "") : joinSuccessCriteriaAndNfr(success, nfr);
        const scParts = splitSuccessCriteriaAndNfr(sc);
        writeLocalShell({
          room: nextRoom,
          goals: g,
          scopeIn: si,
          scopeOut: so,
          targetUsers: tu,
          success: scParts.success,
          nfr: scParts.nfr,
          openIssues: nextRoom.openIssues ?? openIssues,
          priorityFeatures: nextRoom.priorityFeatures ?? priorityFeatures,
        });
        return null;
      }
      setSaveState("saving");
      const nextSavedAt = new Date().toISOString();
      const baseState = mergeRequirementsStateJson(stateJsonRef.current, {
        lastSavedAt: nextSavedAt,
        lastOrganizedAt: organizedAt ?? stateJsonRef.current.lastOrganizedAt,
        selectedTargetId: null,
        selectedMembers: null,
        originalProjectDescription: stateJsonRef.current.originalProjectDescription ?? "",
        onboardingShown: meta?.onboardingShown ?? onboardingAppliedKey === onboardingKey,
        openIssues: meta?.openIssues ?? (openIssues.trim() || ""),
        priorityFeatures: meta?.priorityFeatures ?? (priorityFeatures.trim() || ""),
      });
      const mergedState = meta ? mergeRequirementsStateJson(baseState, meta) : baseState;
      stateJsonRef.current = mergedState;
      const deliverableAssetsSnapshot =
        meta && Array.isArray(meta.deliverableAssets) && meta.deliverableAssets.length ? meta.deliverableAssets : null;
      const body: Record<string, unknown> = {
        requirementsConversationJson: nextRoom.requirementsConversation,
        requirementsDraftJson: nextRoom.requirementsDraft ?? null,
        requirementsStateJson: mergedState,
        requirementsRoomState: {
          ...nextRoom,
          openIssues: openIssues.trim() || undefined,
          priorityFeatures: priorityFeatures.trim() || undefined,
        },
      };
      if (spec.specCoreGoals !== undefined) body.specCoreGoals = spec.specCoreGoals;
      if (spec.specScopeIn !== undefined) body.specScopeIn = spec.specScopeIn;
      if (spec.specScopeOut !== undefined) body.specScopeOut = spec.specScopeOut;
      if (spec.specTargetUsers !== undefined) body.specTargetUsers = spec.specTargetUsers;
      if (spec.specSuccessCriteria !== undefined) body.specSuccessCriteria = spec.specSuccessCriteria;
      const { res, json: raw } = await patchSpecWorkspaceRequest(pid, body);
      const json = raw as SpecWorkspaceProjectPatchResponseBody;
      if (!res.ok || !json.success || !json.data?.project) {
        setSaveState("error");
        throw new Error(json.message || "저장에 실패했습니다.");
      }
      if (json.data.patchApplied === false) {
        setSaveState("error");
        throw new Error(
          json.data.message ||
            json.message ||
            "저장이 DB에 반영되지 않았습니다. 마이그레이션 적용 여부를 확인하거나 잠시 후 다시 시도해 주세요."
        );
      }
      setProject(json.data.project);
      stateJsonRef.current = parseRequirementsStateJson(json.data.project.requirementsStateJson);
      if (deliverableAssetsSnapshot) {
        const after = stateJsonRef.current.deliverableAssets as IdeationDeliverableAsset[] | null | undefined;
        if (!Array.isArray(after) || after.length === 0) {
          stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
            deliverableAssets: deliverableAssetsSnapshot,
          });
        }
      }
      notifyAppFlowProjectContextRefresh();
      setSaveState("saved");
      setLastSavedAt(mergedState.lastSavedAt ?? nextSavedAt);
      return json.data.project;
    },
    []
  );

  return { persistStateJsonOnly, persistServiceFlow, persistRemote };
}
