import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@/lib/git-provisioning/githubApiClient", () => ({
  githubApiFetch: (...args: unknown[]) => fetchMock(...args),
}));

import { createGithubRepository } from "@/lib/git-provisioning/githubRepoCreate";

describe("createGithubRepository", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("parses archived=true from GitHub response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        full_name: "user/my-repo",
        html_url: "https://github.com/user/my-repo",
        default_branch: "main",
        private: true,
        fork: false,
        archived: true,
      }),
    });

    const res = await createGithubRepository({
      repo: "my-repo",
      githubAccessToken: "ghp_test",
    });
    expect(res.ok).toBe(true);
    expect(res.repo?.archived).toBe(true);
  });
});
