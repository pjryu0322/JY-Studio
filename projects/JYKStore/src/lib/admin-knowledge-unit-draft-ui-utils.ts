export function canDecideKnowledgeUnitDraft(draft: {
  reviewStatus: string;
  isActive: boolean;
}): boolean {
  return draft.reviewStatus === "pending_review" && draft.isActive === false;
}

export function canActivateKnowledgeUnitDraft(draft: {
  reviewStatus: string;
  isActive: boolean;
  activationStatus: string | null;
  activatedChunkId: string | null;
  approvedForActivation: boolean | null;
}): boolean {
  return (
    draft.reviewStatus === "approved" &&
    draft.isActive === false &&
    draft.approvedForActivation === true &&
    !draft.activatedChunkId &&
    draft.activationStatus !== "activated"
  );
}
