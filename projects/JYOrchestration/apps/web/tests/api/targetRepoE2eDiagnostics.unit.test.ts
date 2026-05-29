import { describe, expect, it } from "vitest";
import {
  CURSOR_BRIDGE_NOT_CONFIGURED_MESSAGE,
  formatTargetRepoE2eDiagnosticLines,
  formatWorkspaceOriginStatusLine,
  resolveCursorBridgeConnectionPhase,
} from "@/lib/prototype/targetRepoE2eDiagnostics";
import { resolveBridgePushAndPrStatus } from "@/lib/prototype/bridgeCompletionPolicy";
import { executeImplementationQualityGateCheck } from "@/lib/prototype/implementationQualityGate";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("resolveBridgePushAndPrStatus (PR 미연결)", () => {
  it("autoPr=false shows skipped", () => {
    const s = resolveBridgePushAndPrStatus({ autoPush: false, autoPr: false });
    expect(s.prStatusLine).toContain("autoPr=false");
  });

  it("autoPr=true without prNumber shows unconnected", () => {
    const s = resolveBridgePushAndPrStatus({ autoPush: true, autoPr: true, pushed: true });
    expect(s.prStatusLine).toContain("미연결");
  });

  it("autoPr=true with prNumber shows created", () => {
    const s = resolveBridgePushAndPrStatus({ autoPush: true, autoPr: true, pushed: true, prNumber: 7 });
    expect(s.prStatusLine).toContain("#7");
  });
});

describe("formatTargetRepoE2eDiagnosticLines", () => {
  it("includes target repo workspace push PR and unconnected sections", () => {
    const lines = formatTargetRepoE2eDiagnosticLines({
      setup: {
        gitRepoName: "pjryu0322/aiproject",
        gitRepoUrl: "https://github.com/pjryu0322/aiproject",
        baseBranch: "main",
        workspacePath: "C:/workspace/aiproject",
        autoPush: true,
        autoPr: true,
        hasCursorToken: true,
        cursorApiUrl: "https://api.cursor.com",
      },
      workspaceOriginStatus: "unchecked",
      env: { CURSOR_BRIDGE_ENABLED: "true", CURSOR_BRIDGE_ENDPOINT: "http://localhost:1" },
    });
    const text = lines.join("\n");
    expect(text).toContain("실제 소스 생성 대상");
    expect(text).toContain("pjryu0322/aiproject");
    expect(text).toContain(formatWorkspaceOriginStatusLine("unchecked"));
    expect(text).toContain("후속 연결 예정");
    expect(text).toContain("PR 자동 생성: 미연결");
  });
});

describe("resolveCursorBridgeConnectionPhase", () => {
  const plan = buildImplementationTaskPlan({
    projectId: "p1",
    projectArtifacts: [],
    featureDraftTitles: ["x"],
    envOk: true,
    designOk: true,
  });
  const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
  const wip = buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems });

  it("stub wip without bridge is not source_generation_succeeded", () => {
    expect(resolveCursorBridgeConnectionPhase({ wip })).not.toBe("source_generation_succeeded");
  });
});

describe("CURSOR_BRIDGE_NOT_CONFIGURED_MESSAGE", () => {
  it("states WIP-only capability", () => {
    expect(CURSOR_BRIDGE_NOT_CONFIGURED_MESSAGE).toContain("WIP 초안");
  });
});

describe("manual checklist doc", () => {
  it("exists and contains success/failure criteria", () => {
    const candidates = [
      resolve(process.cwd(), "docs/IMPLEMENTATION_STAGE_TARGET_REPO_EXECUTION_TEST.md"),
      resolve(process.cwd(), "../docs/IMPLEMENTATION_STAGE_TARGET_REPO_EXECUTION_TEST.md"),
      resolve(process.cwd(), "../../docs/IMPLEMENTATION_STAGE_TARGET_REPO_EXECUTION_TEST.md"),
    ];
    let content = "";
    for (const p of candidates) {
      try {
        content = readFileSync(p, "utf8");
        break;
      } catch {
        /* try next */
      }
    }
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("## 3. 성공 기준");
    expect(content).toContain("## 4. 실패 기준");
    expect(content).toContain("PR 자동 생성은 아직 미연결");
    expect(content).toContain("diff 엔진");
  });
});

describe("executeImplementationQualityGateCheck diff engine pending", () => {
  const NOW = "2026-05-29T12:00:00.000Z";

  it("does not pass when bridgeTarget commit metadata provided", () => {
    const taskList = {
      version: "implementation_task_list_v1" as const,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed" as const,
      tasks: [
        {
          taskId: "dev-1",
          title: "d",
          description: "d",
          taskType: "feature" as const,
          ownerRole: "developer" as const,
          priority: "high" as const,
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready" as const,
        },
        {
          taskId: "rev-1",
          title: "r",
          description: "r",
          taskType: "validation" as const,
          ownerRole: "reviewer" as const,
          priority: "medium" as const,
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready" as const,
        },
      ],
      roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 0, scm: 0 },
    };
    let execution = {
      version: "implementation_task_execution_state_v1" as const,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      items: taskList.tasks.map((t) => ({
        taskId: t.taskId,
        ownerRole: t.ownerRole,
        status: t.ownerRole === "developer" ? ("done" as const) : ("queued" as const),
        ...(t.ownerRole === "developer" ? { completedAt: NOW } : {}),
      })),
      summary: { total: 2, queued: 1, inProgress: 0, done: 1, failed: 0, blocked: 0 },
    };
    const outcome = executeImplementationQualityGateCheck({
      role: "reviewer",
      taskList,
      executionState: execution,
      projectId: "p1",
      targetTaskIds: ["dev-1"],
      bridgeTarget: {
        commitSha: "abc123def4567890",
        changedFiles: ["src/App.tsx"],
        targetRepository: "pjryu0322/aiproject",
      },
      nowIso: NOW,
    });
    if ("blocked" in outcome) throw new Error("expected outcome");
    expect(outcome.passed).toBe(false);
    expect(outcome.qualityGateResult.engineConnectionStatus).toBe("pending_engine_connection");
    expect(outcome.aiMessageContent).toContain("미연결");
    expect(outcome.aiMessageContent).not.toContain("점검이 완료되었습니다");
  });
});
