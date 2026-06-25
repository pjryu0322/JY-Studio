import { describe, expect, it } from "vitest";
import { clearReferenceSelectionStatePatch } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";
import {
  buildReferencePlanningContextPrepareSuccessMessageMeta,
  referenceContextPrepareFailureNoticeChips,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";

describe("reference planning action helpers", () => {
  it("clearReferenceSelectionStatePatch clears materialized context", () => {
    expect(clearReferenceSelectionStatePatch()).toMatchObject({
      referenceSelectionV1: null,
      referenceSelectionSummaryV1: null,
      materializedReferenceContextV1: null,
    });
  });

  it("success notice meta includes view, continue, and clear chips", () => {
    const meta = buildReferencePlanningContextPrepareSuccessMessageMeta();
    expect(meta.interviewSuggestions).toEqual(["참조 정보 보기", "계속 진행", "참조 해제"]);
  });

  it("failure chips follow policy", () => {
    expect(referenceContextPrepareFailureNoticeChips("SOURCE_UNAVAILABLE")).toEqual(["참조 해제"]);
    expect(referenceContextPrepareFailureNoticeChips("SNAPSHOT_NOT_READY")).toContain("참조 컨텍스트 준비");
  });
});
