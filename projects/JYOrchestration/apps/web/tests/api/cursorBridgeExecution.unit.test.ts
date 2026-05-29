import { describe, expect, it } from "vitest";
import {
  validateBridgeResultForRealSourceGeneration,
  type CursorBridgeExecuteResult,
} from "@/lib/prototype/cursorBridgeExecution";

describe("validateBridgeResultForRealSourceGeneration", () => {
  const base: CursorBridgeExecuteResult = {
    ok: true,
    provider: "cursor",
    status: "completed",
    selectedTaskId: "DEV-1",
    targetRepository: "pjryu0322/aiproject",
    commitSha: "abc123def456",
    changedFiles: ["src/components/App.tsx"],
  };

  it("rejects platform internal generated artifact paths", () => {
    const validation = validateBridgeResultForRealSourceGeneration({
      ...base,
      changedFiles: ["apps/web/src/generated/implementation-wip/dev-1.json"],
    });
    expect(validation.ok).toBe(false);
  });

  it("rejects projects/JYOrchestration platform paths", () => {
    const validation = validateBridgeResultForRealSourceGeneration({
      ...base,
      changedFiles: ["projects/JYOrchestration/apps/web/src/a.ts"],
    });
    expect(validation.ok).toBe(false);
  });

  it("accepts target project source paths with real commitSha", () => {
    const validation = validateBridgeResultForRealSourceGeneration(base);
    expect(validation.ok).toBe(true);
  });

  it("rejects wip-stub sha", () => {
    const validation = validateBridgeResultForRealSourceGeneration({
      ...base,
      commitSha: "wip-stub-123",
    });
    expect(validation.ok).toBe(false);
  });

  it("requires targetRepository in response", () => {
    const validation = validateBridgeResultForRealSourceGeneration({
      ...base,
      targetRepository: undefined,
    });
    expect(validation.ok).toBe(false);
  });
});
