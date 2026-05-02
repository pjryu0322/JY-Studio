import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SpecWorkspaceSnapshot } from "@/components/project-spec/api";
import type { FormState } from "@/components/project-spec/workspaceFormState";
import { buildFallbackProjectPlanMarkdown } from "@/lib/project-spec/parseProjectPlanMarkdown";

export type ProjectSpecWorkspaceHydrateActions = {
  setForm: Dispatch<SetStateAction<FormState>>;
  setWorkingDocument: Dispatch<SetStateAction<string>>;
  setLastSavedWorkingDocument: Dispatch<SetStateAction<string>>;
  setSelectedPlanCandidateId: Dispatch<SetStateAction<string | null>>;
  planWorkspaceHydratedRef: MutableRefObject<boolean>;
};

export function hydrateProjectSpecWorkspaceFromSnapshot(
  snapshot: SpecWorkspaceSnapshot,
  actions: ProjectSpecWorkspaceHydrateActions
): void {
  const p = snapshot.project;
  const {
    setForm,
    setWorkingDocument,
    setLastSavedWorkingDocument,
    setSelectedPlanCandidateId,
    planWorkspaceHydratedRef,
  } = actions;

  setForm({
    name: p.name,
    description: p.description ?? "",
    projectType: p.projectType,
    specCoreGoals: p.specCoreGoals ?? "",
    specScopeIn: p.specScopeIn ?? "",
    specScopeOut: p.specScopeOut ?? "",
    specTargetUsers: p.specTargetUsers ?? "",
    specSuccessCriteria: p.specSuccessCriteria ?? "",
  });

  if (p.executionPlanMarkdown?.trim()) {
    setWorkingDocument(p.executionPlanMarkdown);
    setLastSavedWorkingDocument(p.executionPlanMarkdown);
  } else {
    const slice = {
      specCoreGoals: p.specCoreGoals ?? "",
      specScopeIn: p.specScopeIn ?? "",
      specScopeOut: p.specScopeOut ?? "",
      specTargetUsers: p.specTargetUsers ?? "",
      specSuccessCriteria: p.specSuccessCriteria ?? "",
    };
    const hasAny =
      slice.specCoreGoals.trim() ||
      slice.specScopeIn.trim() ||
      slice.specScopeOut.trim() ||
      slice.specTargetUsers.trim() ||
      slice.specSuccessCriteria.trim();
    if (hasAny) {
      const md = buildFallbackProjectPlanMarkdown(slice);
      setWorkingDocument(md);
      setLastSavedWorkingDocument(md);
    }
  }

  if (p.selectedPlanCandidateId) {
    setSelectedPlanCandidateId(p.selectedPlanCandidateId);
  }
  planWorkspaceHydratedRef.current = true;
}
