import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeGithubPagesPreviewUrl } from "@/lib/prototype/githubPagesPreviewDeployment";

const __dirname = dirname(fileURLToPath(import.meta.url));
const deploySrc = readFileSync(
  join(__dirname, "../../src/lib/prototype/githubPagesPreviewDeploymentService.ts"),
  "utf8",
);
const preflightSrc = readFileSync(
  join(__dirname, "../../src/lib/prototype/githubProviderPreflightService.ts"),
  "utf8",
);

describe("githubPagesDeployWithoutGhPagesBranch", () => {
  it("14-15. deployment does not push to gh-pages branch", () => {
    expect(deploySrc).toContain("runJyoPreviewPagesWorkflowDeploy");
    expect(deploySrc).not.toContain("ensureGhPagesBranchHead");
    expect(deploySrc).not.toContain("git push origin gh-pages");
    expect(deploySrc).not.toContain("gh-pages branch를 활성화");
  });

  it("preflight skips gh-pages branch as required gate", () => {
    expect(preflightSrc).toContain('check("gh_pages_branch_write", "skipped"');
    expect(preflightSrc).toContain("gh-pages branch not required");
  });

  it("20. Preview URL uses owner.github.io/repo/previews/projectId", () => {
    const url = computeGithubPagesPreviewUrl({
      owner: "pjryu0322",
      repo: "aiprogect",
      projectId: "cmphxk7y10015unj0wjms1uch",
    });
    expect(url).toBe(
      "https://pjryu0322.github.io/aiprogect/previews/cmphxk7y10015unj0wjms1uch/",
    );
  });
});
