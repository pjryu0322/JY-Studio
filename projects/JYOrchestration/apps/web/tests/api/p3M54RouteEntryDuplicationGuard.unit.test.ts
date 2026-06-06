import { describe, expect, it } from "vitest";
import { buildStageTwoCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import {
  evaluateStageTwoDeveloperPromptReadiness,
  evaluateStageTwoDeveloperPromptContent,
} from "@/lib/prototype/codeTaskDeveloperPromptQualityGate";
import { ROUTE_ENTRY_DUPLICATE_GUARD_LINE } from "@/lib/prototype/codeTaskRouteBoundaryPlanner";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import { prepareCodeTaskPlanForStageOnePrompt } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-08T12:00:00.000Z";
const PID = "p-m54";
const REPO = {
  owner: "o",
  repo: "r",
  defaultBranch: "main",
  repoFullName: "o/r",
  provider: "github" as const,
  gitRepoUrl: "https://github.com/o/r",
};

function meetingTaskList(): ImplementationTaskListV1 {
  const tasks = [
    { taskId: "DEV-FRAME-001", title: "화면 프레임/앱 Shell 구성", taskType: "feature" as const },
    { taskId: "DEV-MOCK-001", title: "샘플 데이터 생성", taskType: "feature" as const },
    { taskId: "DEV-COMMON-001", title: "로딩 상태 공통 기능 구현", taskType: "feature" as const },
    { taskId: "DEV-FEATURE-001", title: "시작 기능 구현", taskType: "feature" as const },
    { taskId: "DEV-SCREEN-001", title: "입력 화면 화면 구현", taskType: "screen" as const },
  ].map((t) => ({
    ...t,
    description: t.title,
    ownerRole: "developer" as const,
    priority: "high" as const,
    status: "ready" as const,
    dependencies: [],
    acceptanceCriteria: ["a", "b", "c"],
    sourceRefs: [],
  }));
  return {
    version: 1,
    projectId: PID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks,
    roleSummary: { developer: tasks.length, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

function prepared() {
  const list = meetingTaskList();
  const plan = prepareCodeTaskPlanForStageOnePrompt({
    projectId: PID,
    baseBranch: "main",
    plan: buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    }),
    taskList: list,
    nowIso: NOW,
  });
  const map = buildCodeTaskPromptContextMap({
    projectId: PID,
    codeTaskPlan: plan.plan,
    requirementsStateJson: {},
  });
  return { plan: plan.plan, map };
}

describe("P3-M54 route entry duplication guard", () => {
  it("foundation prompt includes duplicate guard and routeEntryDecision", () => {
    const { plan, map } = prepared();
    const frame = plan.tasks.find((t) => t.branchPlan?.branchGroup === "foundation")!;
    const gen = buildStageTwoCodeTaskDeveloperPrompt({
      projectId: PID,
      targetRepository: REPO,
      codeTask: frame,
      promptContext: map.contexts[frame.codeTaskId]!,
      branchPlan: frame.branchPlan!,
      fileBoundary: frame.fileBoundary!,
      nowIso: NOW,
    });
    expect(gen.content).toContain(ROUTE_ENTRY_DUPLICATE_GUARD_LINE);
    expect(gen.content).toContain("package.json과 현재 프레임워크 구조를 확인");
    expect(gen.content).toContain("마지막 수단으로 수행");
    expect(gen.content).toContain("routeEntryDecision:");
    expect(gen.content).toContain("framework 구조 판단 목적의 package.json 열람");
  });

  it("common task omits route duplicate guard when no route candidates", () => {
    const { plan, map } = prepared();
    const common = plan.tasks.find((t) => t.branchPlan?.branchGroup === "common")!;
    const gen = buildStageTwoCodeTaskDeveloperPrompt({
      projectId: PID,
      targetRepository: REPO,
      codeTask: common,
      promptContext: map.contexts[common.codeTaskId]!,
      branchPlan: common.branchPlan!,
      fileBoundary: common.fileBoundary!,
      nowIso: NOW,
    });
    expect(gen.content).not.toContain(ROUTE_ENTRY_DUPLICATE_GUARD_LINE);
    expect(gen.content).not.toContain("routeEntryDecision:");
  });

  it("quality gate blocks foundation prompt missing duplicate guard line", () => {
    const { plan, map } = prepared();
    const frame = plan.tasks.find((t) => t.branchPlan?.branchGroup === "foundation")!;
    const gen = buildStageTwoCodeTaskDeveloperPrompt({
      projectId: PID,
      targetRepository: REPO,
      codeTask: frame,
      promptContext: map.contexts[frame.codeTaskId]!,
      branchPlan: frame.branchPlan!,
      fileBoundary: frame.fileBoundary!,
      nowIso: NOW,
    });
    const stripped = gen.content
      .split("\n")
      .filter((line) => !line.includes("동일 목적의 route/app entry"))
      .join("\n");
    const quality = evaluateStageTwoDeveloperPromptReadiness({
      prompt: stripped,
      codeTask: frame,
      promptContextPresent: true,
      targetRepoFullName: REPO.repoFullName,
    });
    expect(quality.missing).toContain("developer_prompt_route_entry_duplicate_guard_missing");
    expect(quality.ready).toBe(false);
  });

  it("quality gate warns when routeEntryDecision format missing on foundation", () => {
    const { plan, map } = prepared();
    const frame = plan.tasks.find((t) => t.branchPlan?.branchGroup === "foundation")!;
    const gen = buildStageTwoCodeTaskDeveloperPrompt({
      projectId: PID,
      targetRepository: REPO,
      codeTask: frame,
      promptContext: map.contexts[frame.codeTaskId]!,
      branchPlan: frame.branchPlan!,
      fileBoundary: frame.fileBoundary!,
      nowIso: NOW,
    });
    const stripped = gen.content
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("routeEntryDecision:"))
      .join("\n");
    const quality = evaluateStageTwoDeveloperPromptReadiness({
      prompt: stripped,
      codeTask: frame,
      promptContextPresent: true,
      targetRepoFullName: REPO.repoFullName,
    });
    expect(quality.warnings).toContain("developer_prompt_route_entry_decision_missing");
    expect(evaluateStageTwoDeveloperPromptContent({ prompt: gen.content }).readiness).toBe("ready");
  });
});
