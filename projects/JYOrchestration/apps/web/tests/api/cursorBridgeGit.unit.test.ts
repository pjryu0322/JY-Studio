import { describe, expect, it, vi, beforeEach } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

vi.mock("node:util", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:util")>();
  return {
    ...actual,
    promisify: (fn: unknown) => fn,
  };
});

import { pushWorktreeBranch } from "@/lib/prototype/cursorBridgeGit";

function mockGitSequence(calls: ReadonlyArray<Readonly<{ stdout: string; stderr?: string }> | Error>) {
  let i = 0;
  execFileMock.mockImplementation((...args: unknown[]) => {
    const cb = args.find((a) => typeof a === "function") as
      | ((err: Error | null, stdout: string, stderr: string) => void)
      | undefined;
    const next = calls[i++];
    if (!next) {
      const err = new Error("unexpected git call");
      if (cb) {
        cb(err, "", "");
        return;
      }
      return Promise.reject(err);
    }
    if (next instanceof Error) {
      if (cb) {
        cb(next, "", "");
        return;
      }
      return Promise.reject(next);
    }
    const stdout = next.stdout;
    const stderr = next.stderr ?? "";
    if (cb) {
      cb(null, stdout, stderr);
      return;
    }
    return Promise.resolve({ stdout, stderr });
  });
}

describe("cursorBridgeGit pushWorktreeBranch", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("uses token-authenticated push URL when githubAccessToken exists", async () => {
    mockGitSequence([{ stdout: "true" }, { stdout: "" }, { stdout: "" }]);

    const token = "ghp_super_secret_token_value";
    const result = await pushWorktreeBranch({
      workdir: "C:/repo",
      branchName: "wip/cursor/dev-1",
      targetRepository: "owner/repo",
      githubAccessToken: token,
    });

    expect(result.pushed).toBe(true);
    const pushCall = execFileMock.mock.calls.find((call) => (call[1] as string[])[0] === "push");
    expect(String(pushCall?.[1]?.[1])).toContain("https://x-access-token:");
    expect(String(pushCall?.[1]?.[1])).toContain("@github.com/owner/repo.git");
    expect(result.log.join("\n")).not.toContain(token);
  });

  it("sanitizes token from error/log output", async () => {
    const token = "ghp_super_secret_token_value";
    mockGitSequence([
      { stdout: "true" },
      { stdout: "" },
      new Error(`fatal: https://x-access-token:${token}@github.com/o/r.git denied`),
    ]);

    const result = await pushWorktreeBranch({
      workdir: "C:/repo",
      branchName: "wip/cursor/dev-1",
      targetRepository: "owner/repo",
      githubAccessToken: token,
    });

    expect(result.pushed).toBe(false);
    expect(result.errorMessage).not.toContain(token);
    expect(result.log.join("\n")).not.toContain(token);
  });
});
