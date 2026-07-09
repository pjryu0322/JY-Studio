export function canDecideKnowledgeUnitDraft(draft: {
  reviewStatus: string;
  isActive: boolean;
}): boolean {
  return draft.reviewStatus === "pending_review" && draft.isActive === false;
}
