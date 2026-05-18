import { describe, expect, it } from "vitest";
import { ENV_TEST_STAGE2_TASK_KIND, ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import {
  ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD,
  ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD,
  ENV_TEST_STAGE1_MERGE_ALLOWED_RULE,
} from "@/lib/service/envTestMergeFilePolicy";
import {
  evaluateEnvTestMergeGuards,
  isEnvTestMergeWhitelistedPath,
  isEnvTestStage1MergeWhitelistedPath,
} from "@/lib/service/githubEnvTestMergeService";
import { ENV_TEST_PR_TITLE, ENV_TEST_STAGE2_PR_TITLE } from "@/lib/service/githubEnvTestPullRequestService";

describe("isEnvTestStage1MergeWhitelistedPath", () => {
  it("allows orchestration-test/test.sh", () => {
    const r = isEnvTestStage1MergeWhitelistedPath("orchestration-test/test.sh");
    expect(r).toEqual({ ok: true, matchedPathPattern: ENV_TEST_STAGE1_MERGE_ALLOWED_RULE });
  });

  it("allows nested paths under orchestration-test", () => {
    const r = isEnvTestStage1MergeWhitelistedPath("orchestration-test/sub/hello.txt");
    expect(r.ok).toBe(true);
  });

  it("rejects paths outside orchestration-test", () => {
    expect(isEnvTestStage1MergeWhitelistedPath("scripts/test.sh").ok).toBe(false);
  });
});

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

  const stage1Base = {
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

  it("Stage1 + orchestration-test/test.sh: passes", () => {
    const g = evaluateEnvTestMergeGuards({
      ...stage1Base,
      files: [{ filename: "orchestration-test/test.sh" }],
    });
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.envTestFileWhitelistMatches).toEqual([
        { filename: "orchestration-test/test.sh", matchedPathPattern: ENV_TEST_STAGE1_MERGE_ALLOWED_RULE },
      ]);
    }
  });

  it("Stage1 + multiple files under orchestration-test: passes", () => {
    const g = evaluateEnvTestMergeGuards({
      ...stage1Base,
      files: [{ filename: "orchestration-test/a.txt" }, { filename: "orchestration-test/b.txt" }],
    });
    expect(g.ok).toBe(true);
  });

  it("Stage1 + file outside orchestration-test: FILE_OUT_OF_SCOPE with allowed rule in message", () => {
    const g = evaluateEnvTestMergeGuards({
      ...stage1Base,
      files: [{ filename: "README.md" }],
    });
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.blockedCode).toBe("FILE_OUT_OF_SCOPE");
      expect(g.blockedReason).toContain("README.md");
      expect(g.blockedReason).toContain(ENV_TEST_STAGE1_MERGE_ALLOWED_RULE);
      expect(g.diagnostics?.allowedRule).toBe(ENV_TEST_STAGE1_MERGE_ALLOWED_RULE);
      expect(g.diagnostics?.allowedPathGlobs).toEqual([ENV_TEST_STAGE1_MERGE_ALLOWED_RULE]);
    }
  });

  it("non-ENV_TEST taskKind: blocked before file rules (NOT_ENV_TEST)", () => {
    const g = evaluateEnvTestMergeGuards({
      ...stage1Base,
      taskKind: "FEATURE",
    });
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.blockedCode).toBe("NOT_ENV_TEST");
    }
  });

  const stage2Base = {
    taskKind: ENV_TEST_STAGE2_TASK_KIND,
    localBranchName: validHead,
    requiredBaseRef: "main",
    pr: {
      head: { ref: validHead },
      base: { ref: "main" },
      title: ENV_TEST_STAGE2_PR_TITLE,
    },
    files: [{ filename: "orchestration-test/hello-world.md" }],
  };

  it("Stage2 + hello-world.md: passes file whitelist", () => {
    const g = evaluateEnvTestMergeGuards(stage2Base);
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.envTestFileWhitelistMatches).toEqual([
        {
          filename: "orchestration-test/hello-world.md",
          matchedPathPattern: ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD,
        },
      ]);
    }
  });

  it("Stage2 + test.sh under orchestration-test: FILE_OUT_OF_SCOPE", () => {
    const g = evaluateEnvTestMergeGuards({
      ...stage2Base,
      files: [{ filename: "orchestration-test/test.sh" }],
    });
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.blockedCode).toBe("FILE_OUT_OF_SCOPE");
      expect(g.diagnostics?.guardStage).toBe("stage2");
    }
  });
});
