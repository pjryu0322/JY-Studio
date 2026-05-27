import { describe, expect, it } from "vitest";
import { buildPrototypeEnvModalTableRows } from "@/lib/project/prototypeEnvSettingsModalRows";
import { inferGithubHttpsUrlFromOwnerRepo } from "@/lib/executionSetup/inferGithubRepoUrl";

describe("prototypeEnvSettingsModalRows", () => {
  it("builds four status rows without LLM or integrations", () => {
    const rows = buildPrototypeEnvModalTableRows({
      executionSetup: null,
      connectionTestSatisfied: false,
      busyEnvTest: false,
      envTestLast: null,
    });
    expect(rows.map((r) => r.key)).toEqual(["repo", "token", "cursor", "connectionTest"]);
  });

  it("infers github url from owner/repo for save compatibility", () => {
    expect(inferGithubHttpsUrlFromOwnerRepo("pjryu0322/aiproject")).toBe(
      "https://github.com/pjryu0322/aiproject",
    );
  });
});
