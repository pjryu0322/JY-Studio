"use client";

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { fetchProjectWithRetry } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import { readLocalShell } from "@/components/requirements/workspace/requirementsLocalShell";
import type { RequirementsConversation } from "@/lib/requirements/conversationStore";
import type { RequirementsDraftDoc } from "@/lib/requirements/draftStore";
import { parseRequirementsConversationFromProjectJson } from "@/lib/requirements/parseRequirementsConversationFromProject";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
  type RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import { isProbablyOriginalProjectDescription } from "@/lib/project/originalProjectDescription";
import { splitSuccessCriteriaAndNfr } from "@/lib/project/requirementsSuccessCriteriaSplit";
import { parseRequirementsRoomState, type RequirementsRoomStateV3 } from "@/lib/project/requirementsRoomState";

type MemberRow = {
  memberId: string;
  displayName: string | null;
  email: string | null;
  memberType: string;
  role: string;
  isOwner?: boolean;
  userId?: string | null;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
};

export type RequirementsProjectLoadArgs = {
  readonly resolvedProjectId: string;
  readonly fetchNonce: number;
  readonly stateJsonRef: MutableRefObject<RequirementsStateJson>;
  readonly persistStateJsonOnly: (patch: Partial<RequirementsStateJson>) => Promise<void>;
  readonly setConversationStatus: Dispatch<SetStateAction<"idle" | "loading" | "loaded" | "error">>;
  readonly setLoadedConversationProjectId: Dispatch<SetStateAction<string>>;
  readonly setLoadError: Dispatch<SetStateAction<string | null>>;
  readonly setProject: Dispatch<SetStateAction<Project | null>>;
  readonly setRoom: Dispatch<SetStateAction<RequirementsRoomStateV3>>;
  readonly setGoals: Dispatch<SetStateAction<string>>;
  readonly setScopeIn: Dispatch<SetStateAction<string>>;
  readonly setScopeOut: Dispatch<SetStateAction<string>>;
  readonly setTargetUsers: Dispatch<SetStateAction<string>>;
  readonly setSuccess: Dispatch<SetStateAction<string>>;
  readonly setNfr: Dispatch<SetStateAction<string>>;
  readonly setOpenIssues: Dispatch<SetStateAction<string>>;
  readonly setPriorityFeatures: Dispatch<SetStateAction<string>>;
  readonly setLastSavedAt: Dispatch<SetStateAction<string | null>>;
  readonly setOrganizedAt: Dispatch<SetStateAction<string | null>>;
  readonly setServiceFlow: Dispatch<SetStateAction<RequirementsServiceFlowV1 | null>>;
  readonly setInput: Dispatch<SetStateAction<string>>;
  readonly setMembers: Dispatch<SetStateAction<MemberRow[]>>;
  readonly shouldRestoreDraftInput?: () => boolean;
};

export function useRequirementsProjectLoad(args: RequirementsProjectLoadArgs) {
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    const p = argsRef.current;
    if (!p.resolvedProjectId) {
      p.stateJsonRef.current = {};
      const local = readLocalShell();
      if (local) {
        p.setRoom(local.room);
        p.setGoals(local.goals);
        p.setScopeIn(local.scopeIn);
        p.setScopeOut(local.scopeOut);
        p.setTargetUsers(local.targetUsers);
        p.setSuccess(local.success);
        p.setNfr(local.nfr);
        p.setOpenIssues(local.openIssues);
        p.setPriorityFeatures(local.priorityFeatures);
      }
      p.setConversationStatus("loaded");
      return;
    }
    let cancelled = false;
    void (async () => {
      p.setConversationStatus("loading");
      p.setLoadedConversationProjectId("");
      p.setLoadError(null);
      const { project: proj, errorMessage } = await fetchProjectWithRetry(p.resolvedProjectId);
      if (cancelled) return;
      if (!proj) {
        p.setProject(null);
        p.setLoadError(errorMessage || "프로젝트 정보를 잠시 불러오지 못했습니다.");
        p.setMembers([]);
        p.setConversationStatus("error");
        return;
      }
      p.setProject(proj);
      p.setLoadError(null);
      const pid = p.resolvedProjectId.trim();
      const conv = parseRequirementsConversationFromProjectJson(proj.requirementsConversationJson, pid);
      const draft = (proj.requirementsDraftJson as RequirementsDraftDoc | null | undefined) ?? null;
      const state = parseRequirementsStateJson(proj.requirementsStateJson);
      p.stateJsonRef.current = mergeRequirementsStateJson(state, {});
      const legacy = parseRequirementsRoomState(proj.requirementsRoomState);
      const legacyConv = legacy.requirementsConversation;
      const convUserCount = conv.messages.filter((m) => m.role === "user").length;
      const legacyUserCount = legacyConv.messages.filter((m) => m.role === "user").length;
      let chosenConversation: RequirementsConversation;
      if (conv.messages.length === 0 && legacyConv.messages.length > 0) {
        chosenConversation = legacyConv;
      } else if (legacyUserCount > convUserCount && legacyConv.messages.length > conv.messages.length) {
        chosenConversation = legacyConv;
      } else {
        chosenConversation = conv.messages.length > 0 ? conv : legacyConv;
      }
      const r: RequirementsRoomStateV3 = {
        v: 3,
        requirementsConversation: chosenConversation,
        requirementsDraft: draft ?? legacy.requirementsDraft ?? null,
        aiQuestionIndex: legacy.aiQuestionIndex ?? 0,
      };
      p.setRoom(r);
      p.setLoadedConversationProjectId(p.resolvedProjectId);
      p.setGoals(String(proj.specCoreGoals ?? "").trim());
      p.setScopeIn(String(proj.specScopeIn ?? "").trim());
      p.setScopeOut(String(proj.specScopeOut ?? "").trim());
      p.setTargetUsers(String(proj.specTargetUsers ?? "").trim());
      const sc = splitSuccessCriteriaAndNfr(proj.specSuccessCriteria);
      p.setSuccess(sc.success);
      p.setNfr(sc.nfr);
      p.setOpenIssues(state.openIssues ?? legacy.openIssues ?? "");
      p.setPriorityFeatures(state.priorityFeatures ?? legacy.priorityFeatures ?? "");
      p.setLastSavedAt(state.lastSavedAt ?? null);
      p.setOrganizedAt(state.lastOrganizedAt ?? null);
      p.setServiceFlow(state.serviceFlowV1 ?? null);
      if (typeof state.originalProjectDescription !== "string") {
        const cur = (proj.description ?? "").trim();
        if (isProbablyOriginalProjectDescription(cur)) void p.persistStateJsonOnly({ originalProjectDescription: cur });
      }
      const composerDraftText =
        typeof state.lastUserDraftText === "string" ? state.lastUserDraftText.trim() : "";
      if (composerDraftText && p.shouldRestoreDraftInput?.() !== false) {
        p.setInput(composerDraftText);
      }
      p.setConversationStatus("loaded");

      const res = await fetch(`/api/project/members?projectId=${encodeURIComponent(p.resolvedProjectId)}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; data?: MemberRow[] };
      if (cancelled) return;
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        p.setMembers([]);
        return;
      }
      p.setMembers(json.data);
    })();
    return () => {
      cancelled = true;
    };
    // persistStateJsonOnly는 상위 persist 훅에서 안정적인 참조를 유지합니다.
  }, [args.resolvedProjectId, args.fetchNonce]);
}
