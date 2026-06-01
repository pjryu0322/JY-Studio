import { describe, expect, it } from "vitest";
import {
  buildImplementationCodeTaskPlanFromTaskList,
  type ImplementationCodeTaskPlanV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import {
  buildImplementationPlanningReadinessPatch,
  evaluateImplementationPlanningExecutionGate,
} from "@/lib/prototype/implementationPlanningReadiness";
import { buildCursorWorkItemsFromImplementationCodeTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import {
  evaluateImplementationCodeTaskQualityGate,
  type ImplementationCodeTaskQualityGateV1,
} from "@/lib/prototype/implementationCodeTaskQualityGate";
import { runWorkItemPreflightBatch } from "@/lib/prototype/implementationWorkItemPreflight";
import { refineImplementationCodeTaskPlanWithLlm } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-01T00:00:00.000Z";
const PROJECT_ID = "p-ready-exec";

function devTask(taskId: string): ImplementationTaskV1 {
  return {
    taskId,
    title: taskId,
    description: taskId,
    taskType: "screen",
    ownerRole: "developer",
    priority: "medium",
    status: "ready",
    dependencies: [],
    acceptanceCriteria: ["done"],
    sourceRefs: [],
  };
}

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [devTask("DEV-SCREEN-001")],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

function readyEntryFields(patch: ReturnType<typeof buildImplementationPlanningReadinessPatch>) {
  const entry = patch.promptTimeline.find((e) => e.action === "implementation_ready_for_execution");
  const text = String(entry?.responseText ?? "");
  const fields: Record<string, string> = {};
  for (const part of text.split(/\s+/)) {
    const eq = part.indexOf("=");
    if (eq > 0) fields[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return fields;
}

function executionGateForPlan(plan: ImplementationCodeTaskPlanV1, qualityStatus: "passed" | "warning" | "failed") {
  const qualityGate: ImplementationCodeTaskQualityGateV1 =
    qualityStatus === "failed"
      ? {
          version: "implementation_code_task_quality_gate_v1",
          projectId: PROJECT_ID,
          checkedAt: NOW,
          status: "failed",
          issueCount: 1,
          errorCount: 1,
          warningCount: 0,
          issues: [
            {
              codeTaskId: plan.tasks[0]?.codeTaskId ?? "CODE-1",
              severity: "error",
              code: "sample_error",
              message: "blocking",
            },
          ],
        }
      : evaluateImplementationCodeTaskQualityGate({
          projectId: PROJECT_ID,
          codeTaskPlan: plan,
          nowIso: NOW,
        });
  if (qualityStatus === "warning" && qualityGate.status !== "warning") {
    return evaluateImplementationPlanningExecutionGate({
      codeTaskPlan: plan,
      cursorWorkItems: buildCursorWorkItemsFromImplementationCodeTaskPlan({
        projectId: PROJECT_ID,
        codeTaskPlan: plan,
        nowIso: NOW,
        originStage: "planning",
      }),
      preflightSummary: {
        version: "implementation_work_item_preflight_summary_v1",
        projectId: PROJECT_ID,
        checkedAt: NOW,
        status: "passed",
        workItemCount: 1,
        failedWorkItemIds: [],
        failedReasons: [],
      },
      codeTaskQualityGate: {
        ...qualityGate,
        status: "warning",
        errorCount: 0,
        warningCount: 1,
      },
    });
  }
  const cursorWorkItems = buildCursorWorkItemsFromImplementationCodeTaskPlan({
    projectId: PROJECT_ID,
    codeTaskPlan: plan,
    nowIso: NOW,
    originStage: "planning",
  });
  const preflight = runWorkItemPreflightBatch({ workItems: cursorWorkItems });
  return evaluateImplementationPlanningExecutionGate({
    codeTaskPlan: plan,
    cursorWorkItems,
    preflightSummary: {
      version: "implementation_work_item_preflight_summary_v1",
      projectId: PROJECT_ID,
      checkedAt: NOW,
      status: preflight.status,
      workItemCount: cursorWorkItems.length,
      failedWorkItemIds: [...preflight.failedWorkItemIds],
      failedReasons: preflight.results.flatMap((r) => r.failedReasons).slice(0, 5),
    },
    codeTaskQualityGate: qualityGate,
  });
}

describe("implementation_ready_for_execution timeline", () => {
  it("5-7: quality warning does not block ready when validation and preflight pass", () => {
    const patch = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const fields = readyEntryFields(patch);
    expect(fields.ok).toBe("true");
    expect(["warning", "passed"]).toContain(fields.qualityStatus);
  });

  it("5-8: quality failed blocks ready", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const gate = executionGateForPlan(plan, "failed");
    expect(gate.ok).toBe(false);
  });

  it("5-9: llm parse fallback plan can pass execution gate when validation passed", async () => {
    const heuristic = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const refined = await refineImplementationCodeTaskPlanWithLlm({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      heuristicPlan: heuristic,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      forceLlm: true,
      llmCaller: async () => ({ ok: true, text: "not-json" }),
      enableLlmCodeTaskRefinement: true,
      providerContext: { apiKey: "sk-test", model: "gpt-4o-mini", providerSource: "project_execution_setup" },
    });
    expect(refined.plan.refinementStatus).toBe("llm_parse_failed_fallback");
    expect(refined.validationReport.status).toBe("passed");

    const gate = executionGateForPlan(refined.plan, "passed");
    expect(gate.ok).toBe(true);
  });
});
