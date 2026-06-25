import { describe, expect, it } from "vitest";
import {
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY,
  REFERENCE_PLANNING_LEGACY_MISSING_BODY,
  REFERENCE_PLANNING_USER_FACING_COPY,
  assertReferencePlanningUserFacingCopyAllowed,
  referenceContextPrepareFailureNoticeChips,
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";

describe("projectKnowledgeReferencePlanningUiPolicy", () => {
  it("user-facing copy avoids banned terms", () => {
    for (const text of REFERENCE_PLANNING_USER_FACING_COPY) {
      assertReferencePlanningUserFacingCopyAllowed(text);
      expect(text).not.toContain("보정");
      expect(text).not.toContain("재선택");
      expect(text.toLowerCase()).not.toContain("batch");
      expect(text.toLowerCase()).not.toContain("materialize");
      expect(text).not.toContain("materialize-missing");
    }
    expect(REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY).toContain("현재 프로젝트");
    expect(REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY).toContain("수정되지 않습니다");
    expect(REFERENCE_PLANNING_LEGACY_MISSING_BODY).toContain("참조 프로젝트를 수정하지 않고");
  });

  it("failure chip policy matches retry/clear rules", () => {
    expect(referenceContextPrepareFailureNoticeChips("SOURCE_PERMISSION_DENIED")).toEqual(["참조 해제"]);
    expect(referenceContextPrepareFailureNoticeChips("SOURCE_UNAVAILABLE")).toEqual(["참조 해제"]);
    expect(referenceContextPrepareFailureNoticeChips("INVALID_SELECTION")).toEqual(["참조 해제"]);
    expect(referenceContextPrepareFailureNoticeChips("SNAPSHOT_NOT_READY")).toEqual([
      REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
      "참조 해제",
    ]);
    expect(referenceContextPrepareFailureNoticeChips("NO_REFERENCE_SELECTION")).toEqual([]);
  });
});
