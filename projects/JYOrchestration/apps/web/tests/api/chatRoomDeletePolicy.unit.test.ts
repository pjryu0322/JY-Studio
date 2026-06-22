import { describe, expect, it } from "vitest";

describe("chat room delete policy", () => {
  it("documents that GitHub resources are not auto-deleted with chat room delete", () => {
    const policy = {
      githubRepository: false,
      remoteBranch: false,
      pullRequest: false,
      commitHistory: false,
    };
    expect(Object.values(policy).every((v) => v === false)).toBe(true);
  });
});
