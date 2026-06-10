import { describe, expect, it, vi } from "vitest";
import {
  classifyGitHubPagesAutoConfigureHttpFailure,
  ensureGitHubPagesActionsSource,
} from "@/lib/prototype/githubPagesSetupService";
import { parseGitHubPagesSourceModeFromApiResponse } from "@/lib/prototype/githubPagesSetupProbeService";

describe("githubPagesActionsSourceAutoConfigure", () => {
  it("1. GET pages build_type=workflow → already configured", () => {
    const parsed = parseGitHubPagesSourceModeFromApiResponse({
      httpStatus: 200,
      body: { build_type: "workflow" },
    });
    expect(parsed.mode).toBe("actions");
    expect(parsed.preflightStatus).toBe("passed");
  });

  it("2. GET pages branch source → auto configure needed", () => {
    const parsed = parseGitHubPagesSourceModeFromApiResponse({
      httpStatus: 200,
      body: { build_type: "legacy", source: { branch: "main", path: "/" } },
    });
    expect(parsed.mode).toBe("branch");
  });

  it("3. GET pages 404 → disabled / create attempted", () => {
    const parsed = parseGitHubPagesSourceModeFromApiResponse({
      httpStatus: 404,
      body: null,
    });
    expect(parsed.mode).toBe("disabled");
  });

  it("4. GET pages 401/403 → permission_denied", () => {
    const r403 = classifyGitHubPagesAutoConfigureHttpFailure({ httpStatus: 403 });
    expect(r403.failureKind).toBe("permission_denied");
    expect(r403.remediationCode).toBe("add_pages_admin_permissions");
  });

  it("5-7. POST 201 and verify workflow mode", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (String(url).endsWith("/pages") && method === "GET") {
        const call = fetchMock.mock.calls.filter((c) => c[1]?.method === "GET").length;
        if (call <= 1) {
          return new Response("", { status: 404 });
        }
        return new Response(JSON.stringify({ build_type: "workflow" }), { status: 200 });
      }
      if (method === "POST") {
        return new Response("", { status: 201 });
      }
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureGitHubPagesActionsSource({
      repositoryFullName: "o/r",
      owner: "o",
      repo: "r",
      projectId: "p1",
      githubToken: "token",
      defaultBranch: "main",
    });

    vi.unstubAllGlobals();
    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(true);
    expect(result.sourceModeAfter).toBe("actions");
  });

  it("8. 401/403 on configure → add_pages_admin_permissions", () => {
    const r = classifyGitHubPagesAutoConfigureHttpFailure({ httpStatus: 401 });
    expect(r.remediationCode).toBe("add_pages_admin_permissions");
    expect(r.userSafeMessage).toContain("Pages");
  });

  it("9. 422 → operator_review_required", () => {
    const r = classifyGitHubPagesAutoConfigureHttpFailure({ httpStatus: 422 });
    expect(r.failureKind).toBe("invalid_request");
    expect(r.remediationCode).toBe("operator_review_required");
  });

  it("10. rate limit → retry_later", () => {
    const r = classifyGitHubPagesAutoConfigureHttpFailure({
      httpStatus: 429,
      responseHeaders: { "x-ratelimit-remaining": "0" },
    });
    expect(r.remediationCode).toBe("retry_later");
  });

  it("11. 5xx → github_unavailable", () => {
    const r = classifyGitHubPagesAutoConfigureHttpFailure({ httpStatus: 503 });
    expect(r.failureKind).toBe("github_unavailable");
  });
});
