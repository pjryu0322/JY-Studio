import { describe, expect, it } from "vitest";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { formatCodeTaskPromptDraft, formatCodeTaskPromptDraftBundle } from "@/lib/prototype/formatCodeTaskPromptDraft";
import {
  buildImplementationCodeTaskPlanFromTaskList,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";
const PID = "p-draft";

function minimalList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [
      {
        taskId: "DEV-R",
        title: "재시도",
        description: "재시도 UX",
        taskType: "feature",
        ownerRole: "developer",
        priority: "medium",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: ["재시도 버튼"],
        sourceRefs: [],
      },
      {
        taskId: "DEV-E",
        title: "오류 메시지",
        description: "오류 UX",
        taskType: "feature",
        ownerRole: "developer",
        priority: "medium",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: [],
        sourceRefs: [],
      },
    ],
    roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

function seed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: PID,
    createdAt: NOW,
    updatedAt: NOW,
    lifecycleStatus: "confirmed",
    readiness: { ready: true, missing: [] },
    templateContext: {
      templateId: "meeting-workspace",
      templateNameKo: "회의 워크스페이스",
      description: "회의 분석 서비스",
      layoutContract: "JY Orchestration 템플릿 미리보기와 동일한 IA",
      navigationItems: [],
      primarySections: [],
    },
    processImplementationItems: [],
    screenImplementationItems: [],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [
      { name: "재시도", appliesTo: [], description: "", required: true },
      { name: "오류 메시지", appliesTo: [], description: "", required: true },
    ],
    dataAndMockPolicy: [],
  } as ImplementationSeedV1;
}

describe("formatCodeTaskPromptDraft", () => {
  it("excludes platform names from bundle", () => {
    const list = minimalList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: { implementationSeedV1: seed(), implementationTaskListV1: list },
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: list,
      promptContextMap: map,
      templateId: "meeting-workspace",
    });
    expect(text).not.toContain("JY Orchestration");
    expect(text).not.toContain("projects/JYOrchestration");
  });

  it("uses distinct roles and retry template bullets", () => {
    const list = minimalList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const retryTask = plan.tasks.find((t) => /재시도/i.test(t.title))!;
    const errorTask = plan.tasks.find((t) => /오류/i.test(t.title))!;
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: { implementationSeedV1: seed(), implementationTaskListV1: list },
      nowIso: NOW,
    });
    const retryDraft = formatCodeTaskPromptDraft({
      codeTask: retryTask,
      promptContext: map.contexts[retryTask.codeTaskId],
    });
    const errorDraft = formatCodeTaskPromptDraft({
      codeTask: errorTask,
      promptContext: map.contexts[errorTask.codeTaskId],
    });
    expect(retryDraft).toMatch(/RetryButton|onRetry|중복 클릭/);
    expect(errorDraft).toMatch(/ErrorMessage|role="alert"|retry action/);
    const retryRole = retryDraft.match(/- 역할: (.+)/)?.[1];
    const errorRole = errorDraft.match(/- 역할: (.+)/)?.[1];
    expect(retryRole).not.toBe(errorRole);
  });
});
