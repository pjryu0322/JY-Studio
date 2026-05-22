import { describe, expect, it } from "vitest";
import { buildRepoNameCandidate, toSafeGithubRepoName } from "@/lib/git-provisioning/repoNamePolicy";

const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("repoNamePolicy", () => {
  it("slugifies ASCII project names", () => {
    expect(toSafeGithubRepoName("AI Runtime Worker", "jyo-fallback")).toMatch(/^jyo-ai-runtime/);
  });

  it("uses fallback for Korean-only names", () => {
    const name = toSafeGithubRepoName("회의록 자동화", "jyo-p-a1b2c3d4");
    expect(name).toBe("jyo-p-a1b2c3d4");
  });

  it("buildRepoNameCandidate from project name", () => {
    const c = buildRepoNameCandidate({ projectId, projectName: "Runtime Worker" });
    expect(c.repoName).toMatch(/^jyo-runtime-worker/);
  });

  it("buildRepoNameCandidate fallback for Korean project", () => {
    const c = buildRepoNameCandidate({ projectId, projectName: "회의록 자동화" });
    expect(c.repoName).toMatch(/^jyo-p-a1b2c3d4/);
  });
});
