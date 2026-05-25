import { describe, expect, it, vi } from "vitest";
import {
  appendWipPolicyToCodeAgentPrompt,
  buildInitialCodeAgentWipExecution,
  CODE_AGENT_WIP_POLICY_SECTION,
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
  codeAgentIsNotSingleChatMember,
  LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import { parseCodeAgentWipExecutionFromState, parseCodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecutionStateWire";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";
import {
  buildDeveloperApproveWipResult,
  buildRequestCodeAgentWipWorkResult,
  buildScmOfficialCommitRequestResult,
} from "@/lib/prototype/prototypeExecutionCodeAgentWipActions";
import { IMPLEMENTATION_MODE_PRIMARY_MEMBERS } from "@/lib/requirements/modeOrchestrationConfig";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

describe("codeAgentWipExecution", () => {
  it("does not include Cursor as a SingleChat AI member", () => {
    expect(codeAgentIsNotSingleChatMember()).toBe(true);
    expect(IMPLEMENTATION_MODE_PRIMARY_MEMBERS.some((id) => String(id).toLowerCase().includes("cursor"))).toBe(
      false,
    );
  });

  it("adds provider-agnostic WIP policy to code agent prompt", () => {
    expect(appendWipPolicyToCodeAgentPrompt("x").trim()).toContain(CODE_AGENT_WIP_POLICY_SECTION.slice(0, 20));
    expect(appendWipPolicyToCodeAgentPrompt("x").trim()).toContain("실행 도구는 Cursor");
  });

  it("creates code agent WIP execution state when WIP 작업 요청 is selected", () => {
    const result = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems,
      existingWip: undefined,
    });
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.status).toBe("developer_reviewing");
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.commits.length).toBe(1);
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.provider).toBe("cursor");
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.branchName).toMatch(/^wip\/cursor\//);
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.commits[0]?.provider).toBe("cursor");
    expect(result.orchestrationPatch.promptTimeline.some((e) => e.action === "code_agent_wip_requested")).toBe(
      true,
    );
  });

  it("stores provider on code agent WIP execution state", () => {
    const wip = buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems, provider: "cursor" });
    expect(wip.provider).toBe("cursor");
    const parsed = parseCodeAgentWipExecutionV1(wip);
    expect(parsed?.provider).toBe("cursor");
  });

  it("uses provider-based WIP branch naming", () => {
    const wip = buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems });
    expect(wip.branchName).toMatch(/^wip\/cursor\//);
  });

  it("normalizes legacy cursorWipExecutionV1 on read", () => {
    const legacy = {
      version: "cursor_wip_execution_v1",
      projectId: "p1",
      status: "requested",
      branchName: "wip/cursor/upload-task",
      requestedAt: "2026-05-19T00:00:00.000Z",
      requestedBy: "ai_developer",
      workItems: ["wi-1"],
      commits: [],
      refactorRequests: [],
    };
    const parsed = parseCodeAgentWipExecutionFromState(undefined, legacy);
    expect(parsed?.version).toBe("code_agent_wip_execution_v1");
    expect(parsed?.provider).toBe("cursor");
  });

  it("persists codeAgentWipExecutionV1 in requirements state json", () => {
    const wip = buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems });
    const parsed = parseRequirementsStateJson({ codeAgentWipExecutionV1: wip });
    expect(parsed.codeAgentWipExecutionV1?.branchName).toBe(wip.branchName);
    expect(parseCodeAgentWipExecutionV1(wip)?.projectId).toBe("p1");
  });

  it("routes 코드 에이전트 WIP 작업 요청 chip", () => {
    const request = vi.fn();
    tryHandlePrototypeExecutionChip(CODE_AGENT_WIP_WORK_REQUEST_CHIP, {
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
    expect(request).toHaveBeenCalled();
  });

  it("routes legacy Cursor WIP chip to the same handler", () => {
    const request = vi.fn();
    tryHandlePrototypeExecutionChip(LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP, {
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
    expect(request).toHaveBeenCalled();
  });

  it("approves developer result and requests SCM official commit", () => {
    const requested = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems,
      existingWip: undefined,
    });
    expect(requested.kind).toBe("created");
    if (requested.kind !== "created") return;

    const approved = buildDeveloperApproveWipResult({
      requirementsStateJson: {},
      wip: requested.orchestrationPatch.codeAgentWipExecutionV1,
    });
    expect(approved.kind).toBe("approved");
    if (approved.kind !== "approved") return;
    expect(approved.orchestrationPatch.codeAgentWipExecutionV1.status).toBe("developer_approved");

    const scm = buildScmOfficialCommitRequestResult({
      requirementsStateJson: {},
      wip: approved.orchestrationPatch.codeAgentWipExecutionV1,
    });
    expect(scm.kind).toBe("pending");
    if (scm.kind !== "pending") return;
    expect(scm.orchestrationPatch.codeAgentWipExecutionV1.status).toBe("scm_commit_pending");
  });
});
