import { describe, expect, it } from "vitest";
import { ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import {
  ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD,
  ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD,
} from "@/lib/service/envTestMergeFilePolicy";
import {
  evaluateEnvTestMergeGuards,
  isEnvTestMergeWhitelistedPath,
} from "@/lib/service/githubEnvTestMergeService";
import { ENV_TEST_PR_TITLE } from "@/lib/service/githubEnvTestPullRequestService";

describe("isEnvTestMergeWhitelistedPath", () => {
  it("allows orchestration-test/task-xxx.md (flat .md)", () => {
    const r = isEnvTestMergeWhitelistedPath("orchestration-test/task-abc12.md");
    expect(r).toEqual({ ok: true, matchedPathPattern: ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD });
  });

  it("allows nested orchestration-test/**/.md", () => {
    const r = isEnvTestMergeWhitelistedPath("orchestration-test/sub/task.md");
    expect(r).toEqual({ ok: true, matchedPathPattern: ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD });
  });

  it("rejects non-md under orchestration-test", () => {
    expect(isEnvTestMergeWhitelistedPath("orchestration-test/x.txt").ok).toBe(false);
  });

  it("rejects md outside orchestration-test", () => {
    expect(isEnvTestMergeWhitelistedPath("README.md").ok).toBe(false);
  });

  it("rejects empty .md stem", () => {
    expect(isEnvTestMergeWhitelistedPath("orchestration-test/.md").ok).toBe(false);
  });
});

describe("evaluateEnvTestMergeGuards", () => {
  const validHead = "envcheck/t-hello-world-a1b2c3d4";

  const baseInput = {
    taskKind: ENV_TEST_TASK_KIND,
    localBranchName: validHead,
    requiredBaseRef: "main",
    pr: {
      head: { ref: validHead },
      base: { ref: "main" },
      title: ENV_TEST_PR_TITLE,
    },
    files: [{ filename: "orchestration-test/task-xyz.md" }],
  };

  it("ENV_TEST + task-xxx.md: passes file whitelist", () => {
    const g = evaluateEnvTestMergeGuards(baseInput);
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.envTestFileWhitelistMatches).toEqual([
        { filename: "orchestration-test/task-xyz.md", matchedPathPattern: ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD },
      ]);
    }
  });

  it("non-ENV_TEST taskKind: blocked before file rules (NOT_ENV_TEST)", () => {
    const g = evaluateEnvTestMergeGuards({
      ...baseInput,
      taskKind: "FEATURE",
    });
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.blockedCode).toBe("NOT_ENV_TEST");
    }
  });

  it("ENV_TEST + out-of-scope file: FILE_OUT_OF_SCOPE", () => {
    const g = evaluateEnvTestMergeGuards({
      ...baseInput,
      files: [{ filename: "orchestration-test/script.js" }],
    });
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.blockedCode).toBe("FILE_OUT_OF_SCOPE");
    }
  });
});
