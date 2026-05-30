import { describe, expect, it } from "vitest";
import {
  buildImplementationStageActionClickedTimelineEntry,
  resolveImplementationStageActionClick,
} from "@/lib/prototype/implementationStageActionBinding";
import {
  buildInitialCodeAgentWipExecution,
  REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { IMPLEMENTATION_GENERATION_REQUEST_CHIP } from "@/lib/requirements/implementationUxLabels";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

function draftCreatedWip() {
  return buildInitialCodeAgentWipExecution({
    projectId: "p1",
    plan,
    workItems,
    executionMode: "stub",
    bridgeExecutionStatus: "draft_created",
    selectedTaskId: plan.items[0]?.id,
  });
}

describe("resolveImplementationStageActionClick", () => {
  it("re-resolves stale actionId from label for Cursor 실행 요청", () => {
    const resolved = resolveImplementationStageActionClick({
      actionId: "REQUEST_CODE_AGENT_WIP",
      label: REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
      wip: draftCreatedWip(),
    });
    expect(resolved).toBe("REQUEST_CURSOR_BRIDGE_EXECUTION");
  });

  it("keeps explicit actionId when label does not map", () => {
    const resolved = resolveImplementationStageActionClick({
      actionId: "OPEN_ENV_SETTINGS",
      label: "환경설정 열기",
      wip: draftCreatedWip(),
    });
    expect(resolved).toBe("OPEN_ENV_SETTINGS");
  });

  it("생성요청 and Cursor 실행 요청 resolve to different actionIds", () => {
    const wipRequest = resolveImplementationStageActionClick({
      actionId: "REQUEST_CODE_AGENT_WIP",
      label: IMPLEMENTATION_GENERATION_REQUEST_CHIP,
      wip: draftCreatedWip(),
    });
    const cursorRequest = resolveImplementationStageActionClick({
      actionId: "REQUEST_CODE_AGENT_WIP",
      label: REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
      wip: draftCreatedWip(),
    });
    expect(wipRequest).toBe("REQUEST_CODE_AGENT_WIP");
    expect(cursorRequest).toBe("REQUEST_CURSOR_BRIDGE_EXECUTION");
    expect(wipRequest).not.toBe(cursorRequest);
  });
});

describe("buildImplementationStageActionClickedTimelineEntry", () => {
  it("records clicked actionId and context fields", () => {
    const entry = buildImplementationStageActionClickedTimelineEntry({
      actionId: "REQUEST_CURSOR_BRIDGE_EXECUTION",
      label: REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
      source: "execution_board",
      buttonIndex: 0,
      selectedTaskId: "DEV-1",
      currentBridgeExecutionStatus: "draft_created",
      currentExecutionMode: "stub",
      runId: "run-1",
      nowIso: "2026-05-30T12:00:00.000Z",
    });
    expect(entry.action).toBe("implementation_stage_action_clicked");
    expect(entry.routingDecision).toBe("REQUEST_CURSOR_BRIDGE_EXECUTION");
    expect(entry.responseText).toContain("source=execution_board");
    expect(entry.responseText).toContain("actionId=REQUEST_CURSOR_BRIDGE_EXECUTION");
    expect(entry.responseText).toContain("label=Cursor 실행 요청");
    expect(entry.responseText).toContain("currentBridgeExecutionStatus=draft_created");
    expect(entry.responseText).toContain("currentExecutionMode=stub");
  });
});
