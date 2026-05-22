import { describe, expect, it } from "vitest";
import {
  normalizeGithubRepoName,
  repoSlugFromGitRepoName,
  validateGithubRepoName,
} from "@/lib/git-provisioning/repoNamePolicy";

describe("validateGithubRepoName", () => {
  it("accepts valid ASCII repo names", () => {
    expect(validateGithubRepoName("meeting-summary-service")).toEqual({
      ok: true,
      repoName: "meeting-summary-service",
    });
    expect(validateGithubRepoName("meeting_summary.service")).toEqual({
      ok: true,
      repoName: "meeting_summary.service",
    });
  });

  it("rejects Korean and spaces", () => {
    expect(validateGithubRepoName("회의록자동화").ok).toBe(false);
    expect(validateGithubRepoName("회의록자동화").reason).toBe("not_ascii");
    expect(validateGithubRepoName("meeting summary").ok).toBe(false);
  });

  it("rejects owner/repo and URLs", () => {
    expect(validateGithubRepoName("owner/repo").reason).toBe("owner_repo_format");
    expect(validateGithubRepoName("https://github.com/owner/repo").reason).toBe("url_format");
  });

  it("rejects missing, reserved, and too long names", () => {
    expect(validateGithubRepoName("").reason).toBe("missing");
    expect(validateGithubRepoName(".").reason).toBe("reserved");
    expect(validateGithubRepoName("..").reason).toBe("reserved");
    expect(validateGithubRepoName("a".repeat(101)).reason).toBe("too_long");
  });
});

describe("normalizeGithubRepoName", () => {
  it("trims whitespace", () => {
    expect(normalizeGithubRepoName("  my-repo  ")).toBe("my-repo");
  });
});

describe("repoSlugFromGitRepoName", () => {
  it("extracts repo segment from owner/repo", () => {
    expect(repoSlugFromGitRepoName("pjryu0322/meeting-summary-service")).toBe(
      "meeting-summary-service"
    );
  });

  it("returns bare repo name", () => {
    expect(repoSlugFromGitRepoName("meeting-summary-service")).toBe("meeting-summary-service");
  });

  it("returns null for invalid repo segments", () => {
    expect(repoSlugFromGitRepoName("owner/회의록")).toBeNull();
    expect(repoSlugFromGitRepoName("owner/repo name")).toBeNull();
    expect(repoSlugFromGitRepoName("owner/valid-repo")).toBe("valid-repo");
  });
});
