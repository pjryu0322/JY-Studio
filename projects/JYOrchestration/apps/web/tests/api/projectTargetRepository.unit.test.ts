import { describe, expect, it } from "vitest";
import {
  evaluateCursorBridgeSourceGenerationGate,
  resolveProjectTargetRepository,
} from "@/lib/prototype/projectTargetRepository";
import { getCursorBridgeAvailability } from "@/lib/prototype/cursorBridgeRuntime";

describe("resolveProjectTargetRepository", () => {
  it("resolves owner/repo from environment settings", () => {
    const repo = resolveProjectTargetRepository({
      envSettings: {
        gitRepoName: "pjryu0322/aiproject",
        gitRepoUrl: "https://github.com/pjryu0322/aiproject",
        baseBranch: "main",
      },
    });
    expect(repo).toEqual({
      owner: "pjryu0322",
      repo: "aiproject",
      repoFullName: "pjryu0322/aiproject",
      defaultBranch: "main",
      cloneUrl: "https://github.com/pjryu0322/aiproject",
      webUrl: "https://github.com/pjryu0322/aiproject",
    });
  });

  it("returns null when no target repo", () => {
    expect(resolveProjectTargetRepository({})).toBeNull();
    expect(resolveProjectTargetRepository({ envSettings: { gitRepoName: "" } })).toBeNull();
  });

  it("does not default to JY-Studio unless explicitly configured as target repo", () => {
    expect(
      resolveProjectTargetRepository({
        requirementsStateJson: { prototypeExecutionSetup: null },
      }),
    ).toBeNull();
    const explicit = resolveProjectTargetRepository({
      envSettings: { gitRepoName: "jy-studio/jy-studio" },
    });
    expect(explicit?.repoFullName).toBe("jy-studio/jy-studio");
  });
});

describe("evaluateCursorBridgeSourceGenerationGate", () => {
  const target = resolveProjectTargetRepository({
    envSettings: { gitRepoName: "pjryu0322/aiproject", baseBranch: "main" },
  })!;

  it("target repo exists but cursor bridge missing → blocked", () => {
    const availability = getCursorBridgeAvailability({ env: { CURSOR_BRIDGE_ENABLED: "false" } });
    const gate = evaluateCursorBridgeSourceGenerationGate({
      targetRepository: target,
      bridgeAvailable: availability.available,
      bridgeReason: availability.reason,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.message).toContain("Cursor Bridge/API 연결");
    }
  });

  it("missing target repo blocks without bridge call", () => {
    const gate = evaluateCursorBridgeSourceGenerationGate({
      targetRepository: null,
      bridgeAvailable: true,
    });
    expect(gate.ok).toBe(false);
  });
});
