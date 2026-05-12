import type { KnowledgePackDraftResult } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";

/** AI Mock 초안 결과를 등록 폼의 상세 textarea 상태에 반영한다. */
export type KnowledgePackDraftApplyHandlers = Readonly<{
  setSummary: (v: string) => void;
  setLicenseNotes: (v: string) => void;
  setRecommendedUseCases: (v: string) => void;
  setNotRecommendedUseCases: (v: string) => void;
  setCapabilities: (v: string) => void;
  setConstraints: (v: string) => void;
  setImplementationGuidelines: (v: string) => void;
  setCursorPromptRules: (v: string) => void;
  setForbiddenPatterns: (v: string) => void;
  setReviewChecklist: (v: string) => void;
  setSecurityChecklist: (v: string) => void;
  setAlternatives: (v: string) => void;
  setReferences: (v: string) => void;
  setPreviewSpec: (v: string) => void;
}>;

export function applyKnowledgePackDraftResult(draft: KnowledgePackDraftResult, h: KnowledgePackDraftApplyHandlers): void {
  h.setSummary(draft.summary);
  h.setLicenseNotes(draft.licenseNotes);
  h.setRecommendedUseCases(draft.recommendedUseCases);
  h.setNotRecommendedUseCases(draft.notRecommendedUseCases);
  h.setCapabilities(draft.capabilities);
  h.setConstraints(draft.constraints);
  h.setImplementationGuidelines(draft.implementationGuidelines);
  h.setCursorPromptRules(draft.cursorPromptRules);
  h.setForbiddenPatterns(draft.forbiddenPatterns);
  h.setReviewChecklist(draft.reviewChecklist);
  h.setSecurityChecklist(draft.securityChecklist);
  h.setAlternatives(draft.alternatives);
  h.setReferences(draft.references);
  h.setPreviewSpec(draft.previewSpec);
}
