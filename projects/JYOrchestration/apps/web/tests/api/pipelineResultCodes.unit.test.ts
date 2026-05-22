import { describe, expect, it } from "vitest";
import {
  PIPELINE_RESULT_CODE,
  pipelineMessageForCode,
} from "@/lib/runtime/pipelineResultCodes";

describe("pipelineResultCodes", () => {
  it("maps standard pipeline codes to user messages", () => {
    expect(pipelineMessageForCode(PIPELINE_RESULT_CODE.APPROVAL_WAITING, "")).toContain("승인");
    expect(pipelineMessageForCode(PIPELINE_RESULT_CODE.MERGED, "")).toContain("병합");
    expect(pipelineMessageForCode(PIPELINE_RESULT_CODE.MERGE_PENDING, "")).toContain("대기");
    expect(pipelineMessageForCode(PIPELINE_RESULT_CODE.REVIEW_REJECTED, "")).toContain("반려");
    expect(pipelineMessageForCode(PIPELINE_RESULT_CODE.REVIEWER_NOT_CONFIGURED, "")).toContain("Reviewer");
    expect(pipelineMessageForCode(PIPELINE_RESULT_CODE.SCM_NOT_CONFIGURED, "")).toContain("SCM");
    expect(pipelineMessageForCode(PIPELINE_RESULT_CODE.PR_CREATE_FAILED, "")).toContain("PR");
    expect(pipelineMessageForCode(PIPELINE_RESULT_CODE.MERGE_FAILED, "")).toContain("Merge");
  });

  it("falls back to provided message for unknown codes", () => {
    expect(pipelineMessageForCode("UNKNOWN", "custom")).toBe("custom");
  });
});
