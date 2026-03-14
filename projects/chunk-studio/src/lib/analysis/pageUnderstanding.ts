import {
  classifyPageType,
  type PageLayoutProfile,
  type PageTextBlock,
  type PageType,
  type PageTypeScores,
} from "@/components/workspace/pageTypeClassifier";

export type PageOrientation = "portrait" | "landscape";
export type PageSubType =
  | "title_cover"
  | "revision_history_table"
  | "narrative_body"
  | "body_with_diagram"
  | "body_with_table"
  | "table_reference"
  | "body_with_examples";
export type DocumentFamily =
  | "guide_manual"
  | "public_rfp"
  | "policy_manual"
  | "unknown_generic";

export interface PageClassificationRecord {
  pageNumber: number;
  orientationAuto: PageOrientation;
  orientationFinal: PageOrientation;
  pageTypeAuto: PageType;
  pageTypeFinal: PageType;
  subTypeAuto: PageSubType;
  subTypeFinal: PageSubType;
  confidence: number;
  features: PageLayoutProfile;
  scores: PageTypeScores;
  userOverridden: boolean;
  documentFamily: DocumentFamily;
}

export function classifyPageUnderstanding(input: {
  pageNumber: number;
  pageSize: { width: number; height: number };
  blocks: PageTextBlock[];
  familyHint?: DocumentFamily;
}): PageClassificationRecord {
  const orientationAuto: PageOrientation =
    input.pageSize.width > input.pageSize.height ? "landscape" : "portrait";
  const family = input.familyHint ?? detectDocumentFamily(input.blocks);
  const classified = classifyPageType(input.blocks, input.pageNumber);
  const subTypeAuto = resolveSubType(classified.profile, classified.pageType);
  const confidence = estimateConfidence(classified.scores);
  return {
    pageNumber: input.pageNumber,
    orientationAuto,
    orientationFinal: orientationAuto,
    pageTypeAuto: classified.pageType,
    pageTypeFinal: classified.pageType,
    subTypeAuto,
    subTypeFinal: subTypeAuto,
    confidence,
    features: classified.profile,
    scores: classified.scores,
    userOverridden: false,
    documentFamily: family,
  };
}

export function detectDocumentFamily(blocks: PageTextBlock[]): DocumentFamily {
  const text = blocks
    .map((b) => b.text)
    .join(" ")
    .toLowerCase();
  if (/rfp|제안요청서|입찰|평가/.test(text)) return "public_rfp";
  if (/규정|정책|policy|지침/.test(text)) return "policy_manual";
  if (/manual|guide|운영|절차|프로세스/.test(text)) return "guide_manual";
  return "unknown_generic";
}

export function resolveSubType(profile: PageLayoutProfile, pageType: PageType): PageSubType {
  if (pageType === "cover") return "title_cover";
  if (pageType === "table") {
    return profile.sectionNumberRatio > 0.35 ? "table_reference" : "revision_history_table";
  }
  if (pageType === "revision_or_form") return "revision_history_table";
  if (pageType === "toc") return "table_reference";
  if (profile.gridStructureScore > 0.55) return "body_with_table";
  if (profile.largeTextBlockCount >= 4 && profile.shortLineRatio > 0.3) return "body_with_examples";
  if (profile.centerAlignmentRatio > 0.25 && profile.longLineRatio < 0.5) return "body_with_diagram";
  return "narrative_body";
}

export function estimateConfidence(scores: PageTypeScores): number {
  const values = [
    scores.coverScore,
    scores.tocScore,
    scores.tableScore,
    scores.bodyScore,
    scores.revisionScore,
  ].sort((a, b) => b - a);
  const top = values[0] ?? 0;
  const second = values[1] ?? 0;
  return clamp(top - second * 0.35 + 0.2, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
