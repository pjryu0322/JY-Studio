import { describe, expect, it } from "vitest";
import {
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
  REFERENCE_PLANNING_LEGACY_MISSING_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY,
  REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";
import {
  buildReferenceMaterializeFailureNoticeBody,
  parseReferenceMaterializeApiResponse,
  referenceMaterializeFailureNoticeChips,
  resolveReferenceMaterializeFailureActionPolicy,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializeClient";
import { buildReferenceMaterializeApiPath } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";

const USER_FACING_COPY = [
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
  REFERENCE_PLANNING_LEGACY_MISSING_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY,
  REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE,
];

function assertNoDeprecatedReferenceUxTerms(text: string): void {
  expect(text).not.toContain("보정");
  expect(text).not.toContain("재선택");
}

describe("projectKnowledgeReferenceMaterializeClient", () => {
  it("user-facing copy avoids 보정/재선택 and states target-project boundary", () => {
    for (const text of USER_FACING_COPY) {
      assertNoDeprecatedReferenceUxTerms(text);
    }
    expect(REFERENCE_PLANNING_LEGACY_MISSING_BODY).toContain("현재 프로젝트");
    expect(REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY).toContain("현재 프로젝트");
    expect(REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY).toContain("수정되지 않습니다");
    expect(REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT).toBe("참조 컨텍스트 준비");
  });

  it("parses materialize success response", () => {
    const result = parseReferenceMaterializeApiResponse({
      ok: true,
      status: 200,
      json: {
        success: true,
        data: { status: "MATERIALIZED", referenceContextSource: "MATERIALIZED" },
      },
    });
    expect(result.ok).toBe(true);
  });

  it("parses failure with status and failure notice chips", () => {
    const result = parseReferenceMaterializeApiResponse({
      ok: false,
      status: 400,
      json: {
        success: false,
        message: "참조 저장본을 다시 확인할 수 없습니다. 참조를 해제해 주세요.",
        data: { status: "SOURCE_UNAVAILABLE", referenceContextSource: "LEGACY_MISSING" },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("SOURCE_UNAVAILABLE");
      expect(result.failureNoticeChips).toEqual(["참조 해제"]);
      assertNoDeprecatedReferenceUxTerms(result.noticeBody);
    }
  });

  it("maps failure statuses to user-facing bodies and chip policy", () => {
    expect(buildReferenceMaterializeFailureNoticeBody("SNAPSHOT_NOT_READY")).toContain("준비되지");
    expect(resolveReferenceMaterializeFailureActionPolicy("SNAPSHOT_NOT_READY")).toBe("RETRY_AND_CLEAR");
    expect(referenceMaterializeFailureNoticeChips("SNAPSHOT_NOT_READY")).toContain(
      REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
    );
    expect(resolveReferenceMaterializeFailureActionPolicy("SOURCE_UNAVAILABLE")).toBe("CLEAR_ONLY");
    expect(referenceMaterializeFailureNoticeChips("INVALID_SELECTION")).toEqual(["참조 해제"]);
  });

  it("buildReferenceMaterializeApiPath returns encoded path", () => {
    expect(buildReferenceMaterializeApiPath("p1")).toBe(
      "/api/projects/p1/reference-selection/materialize",
    );
  });

  it("legacy diagnostic message has no internal ids", () => {
    expect(REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE).not.toMatch(
      /revision|entityKey|sourceSnapshotId|[0-9a-f]{8}-[0-9a-f]{4}-/i,
    );
  });
});
