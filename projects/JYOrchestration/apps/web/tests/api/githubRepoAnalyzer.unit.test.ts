import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@/lib/git-provisioning/githubApiClient", () => ({
  githubApiFetch: (...args: unknown[]) => fetchMock(...args),
}));

import { analyzeGithubRepository } from "@/lib/git-provisioning/githubRepoAnalyzer";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("analyzeGithubRepository", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("classifies empty repo as low risk", async () => {
    fetchMock.mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("/contents?")) {
        return Promise.resolve(jsonResponse(200, [{ name: "README.md", type: "file" }]));
      }
      if (p.match(/\/repos\/o\/r$/)) {
        return Promise.resolve(
          jsonResponse(200, {
            full_name: "o/r",
            html_url: "https://github.com/o/r",
            default_branch: "main",
            private: true,
            fork: false,
            archived: false,
          })
        );
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    const res = await analyzeGithubRepository({
      owner: "o",
      repo: "r",
      githubAccessToken: "token",
    });
    expect(res.ok).toBe(true);
    expect(res.summary?.riskLevel).toBe("low");
    expect(res.summary?.hasReadme).toBe(true);
  });

  it("classifies package.json repo as medium or high", async () => {
    fetchMock.mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("/contents?")) {
        return Promise.resolve(
          jsonResponse(200, [
            { name: "package.json", type: "file" },
            { name: "src", type: "dir" },
            { name: "apps", type: "dir" },
          ])
        );
      }
      if (p.match(/\/repos\/o\/app$/)) {
        return Promise.resolve(
          jsonResponse(200, {
            full_name: "o/app",
            html_url: "https://github.com/o/app",
            default_branch: "main",
            private: false,
            fork: false,
            archived: false,
          })
        );
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    const res = await analyzeGithubRepository({
      owner: "o",
      repo: "app",
      githubAccessToken: "token",
    });
    expect(res.ok).toBe(true);
    expect(res.summary?.hasPackageJson).toBe(true);
    expect(["medium", "high"]).toContain(res.summary?.riskLevel);
  });
});
