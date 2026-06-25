import { describe, expect, it } from "vitest";
import {
  buildReferenceMaterializeFailureNoticeBody,
  parseReferenceMaterializeApiResponse,
  shouldSuggestReferenceClearAfterMaterializeFailure,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializeClient";
import { buildReferenceMaterializeApiPath } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";
import { REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";

describe("projectKnowledgeReferenceMaterializeClient", () => {
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

  it("parses failure with status and suggests clear", () => {
    const result = parseReferenceMaterializeApiResponse({
      ok: false,
      status: 400,
      json: {
        success: false,
        message: "참조 저장본을 다시 확인할 수 없습니다. 참조 프로젝트를 다시 선택해 주세요.",
        data: { status: "SOURCE_UNAVAILABLE", referenceContextSource: "LEGACY_MISSING" },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("SOURCE_UNAVAILABLE");
      expect(result.suggestClear).toBe(true);
      expect(result.noticeBody).not.toMatch(/revision|entityKey|sourceSnapshotId/i);
    }
  });

  it("maps failure statuses to user-facing bodies", () => {
    expect(buildReferenceMaterializeFailureNoticeBody("SNAPSHOT_NOT_READY")).toContain("준비되지");
    expect(shouldSuggestReferenceClearAfterMaterializeFailure("INVALID_SELECTION")).toBe(true);
    expect(shouldSuggestReferenceClearAfterMaterializeFailure("NO_REFERENCE_SELECTION")).toBe(false);
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
