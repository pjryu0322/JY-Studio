import { describe, expect, it } from "vitest";
import {
  isFinalScmPlatformExecutionCompleted,
  prepareCodeAgentWipForFinalScmIntegratedStage,
  validateFinalScmIntegratedStageReadiness,
} from "@/lib/prototype/implementationFinalScmIntegratedStage";
import { buildPlatformScmExecutionPersistPatch } from "@/lib/prototype/prototypeExecutionPlatformScmActions";
import { buildInitialImplementationIntegratedExecutionState } from "@/lib/prototype/implementationIntegratedExecutionState";
import {
  buildPlatformScmWipFixture,
  platformScmWipFixtureWorkItems,
} from "../fixtures/platformScmWipFixture";

describe("implementationFinalScmIntegratedStage", () => {
  it("validateFinalScmIntegratedStageReadiness requires developer approval before execution", () => {
    const result = validateFinalScmIntegratedStageReadiness(
      buildPlatformScmWipFixture({
        preset: "developer_approved",
        overrides: { status: "developer_reviewing" },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("구현 결과 승인");
  });

  it("prepareCodeAgentWipForFinalScmIntegratedStage moves developer_approved to scm_commit_pending", () => {
    const prepared = prepareCodeAgentWipForFinalScmIntegratedStage({
      wip: buildPlatformScmWipFixture({ preset: "developer_approved" }),
      nowIso: "2026-05-30T01:00:00.000Z",
    });
    expect(prepared.status).toBe("scm_commit_pending");
    expect(prepared.platformScmExecutionV1?.pushStatus).toBe("push_requested");
  });

  it("isFinalScmPlatformExecutionCompleted detects pr_completed", () => {
    const wip = buildPlatformScmWipFixture({
      preset: "developer_approved",
      overrides: {
        platformScmExecutionV1: {
          version: "platform_scm_execution_v1",
          projectId: "p1",
          selectedTaskId: platformScmWipFixtureWorkItems[0]!.taskId,
          sourceCommitSha: "abc1234567890abcdef",
          sourceBranchName: "wip/cursor/dev-1",
          targetRepository: "owner/repo",
          pushStatus: "pr_completed",
          prNumber: 7,
          createdAt: "2026-05-30T00:00:00.000Z",
          updatedAt: "2026-05-30T01:00:00.000Z",
        },
      },
    });
    expect(isFinalScmPlatformExecutionCompleted(wip)).toBe(true);
  });

  it("buildPlatformScmExecutionPersistPatch finalizes integrated final_scm on success", () => {
    const wip = buildPlatformScmWipFixture({ preset: "developer_approved" });
    let integrated = buildInitialImplementationIntegratedExecutionState({ projectId: "p1" });
    integrated = {
      ...integrated,
      items: integrated.items.map((item) =>
        item.step === "final_scm"
          ? { ...item, status: "in_progress" as const, startedAt: "2026-05-30T00:00:00.000Z" }
          : item.step === "refactor_common" ||
              item.step === "integrated_review" ||
              item.step === "integrated_security"
            ? { ...item, status: "done" as const, completedAt: "2026-05-30T00:00:00.000Z" }
            : item,
      ),
    };
    const patch = buildPlatformScmExecutionPersistPatch({
      requirementsStateJson: {},
      wip,
      executorResult: {
        ok: true,
        status: "completed",
        message: "PR #42 created",
        platformScmExecutionV1: {
          version: "platform_scm_execution_v1",
          projectId: "p1",
          selectedTaskId: platformScmWipFixtureWorkItems[0]!.taskId,
          sourceCommitSha: "abc1234567890abcdef",
          sourceBranchName: "wip/cursor/dev-1",
          targetRepository: "owner/repo",
          pushStatus: "pr_completed",
          prNumber: 42,
          createdAt: "2026-05-30T00:00:00.000Z",
          updatedAt: "2026-05-30T01:00:00.000Z",
        },
        prNumber: 42,
      },
      integratedExecutionState: integrated,
      projectId: "p1",
      finalizeIntegratedFinalScm: true,
      taskRowsCompleted: true,
    });
    expect(patch.orchestration.kind).toBe("completed");
    expect(patch.integratedExecutionState?.items.find((i) => i.step === "final_scm")?.status).toBe("done");
  });
});
