import { describe, expect, it } from "vitest";
import {
  buildReferenceContextPrepareFailureNoticeBody,
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
  REFERENCE_PLANNING_LEGACY_MISSING_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY,
  REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE,
  referenceContextPrepareFailureNoticeChips,
  resolveReferenceContextPrepareFailureActionPolicy,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";
import {
  parseReferencePrepareContextApiResponse,
  parseReferenceMaterializeApiResponse,
  postReferenceMaterializeForProject,
  postReferencePrepareContextForProject,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializeClient";
import {
  buildReferencePrepareContextApiPath,
  buildReferenceMaterializeApiPath,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";

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
  expect(text.toLowerCase()).not.toContain("batch");
  expect(text.toLowerCase()).not.toContain("materialize");
}

describe("projectKnowledgeReferenceMaterializeClient", () => {
  it("user-facing copy avoids banned terms and states target-project boundary", () => {
    for (const text of USER_FACING_COPY) {
      assertNoDeprecatedReferenceUxTerms(text);
    }
    expect(REFERENCE_PLANNING_LEGACY_MISSING_BODY).toContain("현재 프로젝트");
    expect(REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY).toContain("현재 프로젝트");
    expect(REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY).toContain("수정되지 않습니다");
    expect(REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT).toBe("참조 컨텍스트 준비");
  });

  it("parses prepare-context success response", () => {
    const result = parseReferencePrepareContextApiResponse({
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
    const result = parseReferencePrepareContextApiResponse({
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
    expect(buildReferenceContextPrepareFailureNoticeBody("SNAPSHOT_NOT_READY")).toContain("준비되지");
    expect(resolveReferenceContextPrepareFailureActionPolicy("SNAPSHOT_NOT_READY")).toBe("RETRY_AND_CLEAR");
    expect(referenceContextPrepareFailureNoticeChips("SNAPSHOT_NOT_READY")).toContain(
      REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
    );
    expect(resolveReferenceContextPrepareFailureActionPolicy("SOURCE_UNAVAILABLE")).toBe("CLEAR_ONLY");
    expect(referenceContextPrepareFailureNoticeChips("INVALID_SELECTION")).toEqual(["참조 해제"]);
  });

  it("buildReferencePrepareContextApiPath returns legacy-compatible path", () => {
    expect(buildReferencePrepareContextApiPath("p1")).toBe(
      "/api/projects/p1/reference-selection/materialize",
    );
    expect(buildReferenceMaterializeApiPath("p1")).toBe(buildReferencePrepareContextApiPath("p1"));
  });

  it("deprecated postReferenceMaterializeForProject aliases prepare-context client", () => {
    expect(postReferenceMaterializeForProject).toBe(postReferencePrepareContextForProject);
  });

  it("deprecated parseReferenceMaterializeApiResponse aliases prepare-context parser", () => {
    const payload = {
      ok: true,
      status: 200,
      json: { success: true, data: { status: "ALREADY_MATERIALIZED" } },
    };
    expect(parseReferenceMaterializeApiResponse(payload)).toEqual(
      parseReferencePrepareContextApiResponse(payload),
    );
  });

  it("legacy diagnostic message has no internal ids", () => {
    expect(REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE).not.toMatch(
      /revision|entityKey|sourceSnapshotId|[0-9a-f]{8}-[0-9a-f]{4}-/i,
    );
  });
});
