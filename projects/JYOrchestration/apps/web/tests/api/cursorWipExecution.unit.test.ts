import { describe, expect, it, vi } from "vitest";
import {
  appendWipPolicyToCursorPrompt,
  buildInitialCursorWipExecution,
  buildWipBranchName,
  cursorIsNotSingleChatMember,
  CURSOR_WIP_POLICY_SECTION,
} from "@/lib/prototype/cursorWipExecution";
import { parseCursorWipExecutionV1 } from "@/lib/prototype/cursorWipExecutionStateWire";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  buildDeveloperApproveWipResult,
  buildRequestCursorWipWorkResult,
  buildScmOfficialCommitRequestResult,
} from "@/lib/prototype/prototypeExecutionCursorWipActions";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { IMPLEMENTATION_MODE_PRIMARY_MEMBERS } from "@/lib/requirements/modeOrchestrationConfig";

describe("cursor Wip execution (legacy aliases)", () => {
  const plan = buildImplementationTaskPlan({
    projectId: "p1",
    projectArtifacts: [],
    featureDraftTitles: ["업로드 기능"],
    envOk: true,
    designOk: true,
  });
  const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

  it("does not include Cursor as a SingleChat AI member", () => {
    expect(cursorIsNotSingleChatMember()).toBe(true);
    expect(IMPLEMENTATION_MODE_PRIMARY_MEMBERS).not.toContain("cursor");
  });

  it("adds WIP policy to cursor work item prompt", () => {
    const prompt = workItems[0]?.prompt ?? "";
    expect(prompt).toContain("## WIP 작업 정책");
    expect(prompt).toContain("공식 push/PR/merge");
    expect(prompt).toContain("AI개발자 승인");
    expect(appendWipPolicyToCursorPrompt("x").trim()).toContain(CURSOR_WIP_POLICY_SECTION.slice(0, 20));
  });

  it("creates WIP execution via legacy cursor action wrapper", () => {
    const result = buildRequestCursorWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems,
      existingWip: null,
    });
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    expect(result.orchestrationPatch.cursorWipExecutionV1.status).toBe("developer_reviewing");
    expect(result.orchestrationPatch.cursorWipExecutionV1.provider).toBe("cursor");
    expect(result.orchestrationPatch.cursorWipExecutionV1.branchName).toMatch(/^wip\/cursor\//);
    expect(result.chatPatch.messages.some((m) => m.content.includes("실행 도구: Cursor"))).toBe(true);
    expect(result.orchestrationPatch.promptTimeline.some((e) => e.action === "code_agent_wip_requested")).toBe(
      true,
    );
  });

  it("blocks developer approval without WIP commit result", () => {
    const wip = buildInitialCursorWipExecution({ projectId: "p1", plan, workItems });
    const result = buildDeveloperApproveWipResult({
      requirementsStateJson: {},
      wip,
    });
    expect(result.kind).toBe("blocked");
  });

  it("moves to SCM official commit pending after developer approval", () => {
    const requested = buildRequestCursorWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems,
      existingWip: null,
    });
    expect(requested.kind).toBe("created");
    if (requested.kind !== "created") return;
    const approved = buildDeveloperApproveWipResult({
      requirementsStateJson: {},
      wip: requested.orchestrationPatch.cursorWipExecutionV1,
      promptTimeline: requested.orchestrationPatch.promptTimeline,
    });
    expect(approved.kind).toBe("approved");
    if (approved.kind !== "approved") return;
    expect(approved.orchestrationPatch.cursorWipExecutionV1.status).toBe("developer_approved");

    const scm = buildScmOfficialCommitRequestResult({
      requirementsStateJson: {},
      wip: approved.orchestrationPatch.cursorWipExecutionV1,
    });
    expect(scm.kind).toBe("pending");
    if (scm.kind !== "pending") return;
    expect(scm.orchestrationPatch.cursorWipExecutionV1.status).toBe("scm_commit_pending");
    expect(scm.chatPatch.messages.some((m) => m.speakerId === "memo")).toBe(true);
  });

  it("reads legacy cursorWipExecutionV1 from requirements state json", () => {
    const wip = buildInitialCursorWipExecution({ projectId: "p1", plan, workItems });
    const legacyBlob = {
      version: "cursor_wip_execution_v1",
      projectId: wip.projectId,
      status: wip.status,
      branchName: wip.branchName,
      requestedAt: wip.requestedAt,
      requestedBy: wip.requestedBy,
      workItems: wip.workItems,
      commits: [],
      refactorRequests: [],
    };
    const parsed = parseRequirementsStateJson({ cursorWipExecutionV1: legacyBlob });
    expect(parsed.codeAgentWipExecutionV1?.branchName).toBe(wip.branchName);
    expect(parseCursorWipExecutionV1(legacyBlob)?.projectId).toBe("p1");
  });

  it("routes legacy Cursor WIP chip label", () => {
    const request = vi.fn();
    tryHandlePrototypeExecutionChip("Cursor WIP 작업 요청", {
      openEnvSettings: vi.fn(),
      openArtifactHub: vi.fn(),
      focusComposerForScopeEdit: vi.fn(),
      confirmImplementationTaskPlan: vi.fn(),
      requestCodeAgentWipWork: request,
      viewWipChanges: vi.fn(),
      requestRefactor: vi.fn(),
      requestAdditionalEdit: vi.fn(),
      approveDeveloperResult: vi.fn(),
      discardWipWork: vi.fn(),
      requestScmOfficialCommit: vi.fn(),
      prepareImplementationExecution: vi.fn(),
      confirmExecution: vi.fn(),
      refreshStatus: vi.fn(),
      showToast: vi.fn(),
      canConfirmImplementationTaskPlan: () => true,
      canRequestCodeAgentWipWork: () => true,
      canApproveDeveloperResult: () => true,
      canRequestScmOfficialCommit: () => true,
      canConfirmExecution: () => true,
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it("builds wip branch from task id", () => {
    expect(buildWipBranchName("proj-1", "impl-task-1-upload")).toBe("wip/cursor/impl-task-1-upload");
  });
});
