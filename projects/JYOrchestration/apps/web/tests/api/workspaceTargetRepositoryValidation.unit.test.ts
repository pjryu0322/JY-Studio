import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import {
  formatWorkspaceOriginMismatchMessage,
  parseOwnerRepoFromGitRemoteUrl,
  validateWorkspaceMatchesTargetRepository,
} from "@/lib/prototype/workspaceTargetRepositoryValidation";

function mockGitSequence(calls: ReadonlyArray<Readonly<{ stdout: string; stderr?: string }> | Error>) {
  let i = 0;
  execFileMock.mockImplementation((...args: unknown[]) => {
    const cb = args.find((a) => typeof a === "function") as
      | ((err: Error | null, stdout: string, stderr: string) => void)
      | undefined;
    if (!cb) throw new Error("execFile callback missing");
    const next = calls[i++];
    if (!next) {
      cb(new Error("unexpected git call"), "", "");
      return;
    }
    if (next instanceof Error) {
      cb(next, "", "");
      return;
    }
    cb(null, next.stdout, next.stderr ?? "");
  });
}

describe("parseOwnerRepoFromGitRemoteUrl", () => {
  it("parses https github url", () => {
    expect(
      parseOwnerRepoFromGitRemoteUrl("https://github.com/pjryu0322/aiproject.git"),
    ).toEqual({ owner: "pjryu0322", repo: "aiproject" });
  });

  it("parses git@github.com ssh url", () => {
    expect(parseOwnerRepoFromGitRemoteUrl("git@github.com:pjryu0322/JY-Studio.git")).toEqual({
      owner: "pjryu0322",
      repo: "JY-Studio",
    });
  });
});

describe("formatWorkspaceOriginMismatchMessage", () => {
  it("includes expected and actual repo lines", () => {
    const msg = formatWorkspaceOriginMismatchMessage({
      expectedRepoFullName: "pjryu0322/aiproject",
      actualRemote: "pjryu0322/JY-Studio",
    });
    expect(msg).toContain("환경설정 저장소: pjryu0322/aiproject");
    expect(msg).toContain("workspace origin: pjryu0322/JY-Studio");
  });
});

describe("validateWorkspaceMatchesTargetRepository", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("matching origin passes", async () => {
    mockGitSequence([
      { stdout: "true" },
      { stdout: "https://github.com/pjryu0322/aiproject.git" },
    ]);
    const result = await validateWorkspaceMatchesTargetRepository({
      workspacePath: "C:/workspace/aiproject",
      targetRepoFullName: "pjryu0322/aiproject",
    });
    expect(result.ok).toBe(true);
  });

  it("mismatched origin blocks", async () => {
    mockGitSequence([
      { stdout: "true" },
      { stdout: "https://github.com/pjryu0322/JY-Studio.git" },
    ]);
    const result = await validateWorkspaceMatchesTargetRepository({
      workspacePath: "C:/workspace/JY-Studio",
      targetRepoFullName: "pjryu0322/aiproject",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("일치하지 않습니다");
    expect(result.actualRemote).toBe("pjryu0322/JY-Studio");
  });

  it("non-git workspace blocks", async () => {
    mockGitSequence([new Error("not a git repository")]);
    const result = await validateWorkspaceMatchesTargetRepository({
      workspacePath: "C:/not-git",
      targetRepoFullName: "pjryu0322/aiproject",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("Git worktree");
  });

  it("missing origin blocks", async () => {
    mockGitSequence([{ stdout: "true" }, new Error("No such remote")]);
    const result = await validateWorkspaceMatchesTargetRepository({
      workspacePath: "C:/workspace/aiproject",
      targetRepoFullName: "pjryu0322/aiproject",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("origin");
  });
});
