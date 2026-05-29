import { describe, expect, it } from "vitest";
import {
  appendWipPolicyToCodeAgentPrompt,
  buildCodeAgentWipExecutionMessage,
  buildImplementationWipDraftLifecycleTimelineEntry,
  buildInitialCodeAgentWipExecution,
  CODE_AGENT_WIP_DRAFT_APPROVE_CHIP,
  REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
  describeDeveloperApprovalPrecheck,
  evaluateDeveloperApprovalGate,
  formatCodeAgentExecutionModeDiagnosticLines,
  CODE_AGENT_WIP_POLICY_SECTION,
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
  codeAgentIsNotSingleChatMember,
  deriveCodeAgentWipReviewChips,
  LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import { parseCodeAgentWipExecutionFromState, parseCodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecutionStateWire";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { mapImplementationChipToAction } from "@/lib/prototype/effectiveImplementationState";
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

  it("parseCodeAgentWipExecutionV1 preserves bridge push fields and target snapshot", () => {
    const raw = {
      version: "code_agent_wip_execution_v1",
      projectId: "p1",
      provider: "cursor",
      status: "developer_reviewing",
      branchName: "wip/cursor/x",
      requestedAt: "2026-05-29T00:00:00.000Z",
      requestedBy: "ai_developer",
      workItems: ["wi-1"],
      commits: [],
      developerReview: {
        status: "pending",
        reviewedAt: "2026-05-29T00:00:00.000Z",
        reviewedBy: "ai_developer",
        summary: "x",
        findings: [],
        requestedActions: [],
      },
      refactorRequests: [],
      bridgeExecutionStatus: "bridge_completed",
      commitSha: "abc123",
      pushStatus: "skipped",
      pushErrorMessage: "",
      prStatus: "PR: 미수행 — 환경설정 autoPr=false",
      workspacePath: "C:/ws",
      baseBranch: "main",
      targetRepositorySnapshot: {
        owner: "pjryu0322",
        repo: "aiproject",
        repoFullName: "pjryu0322/aiproject",
        gitRepoUrl: "https://github.com/pjryu0322/aiproject",
        defaultBranch: "main",
      },
      bridgeAllowedPathGlobs: ["src/**"],
      bridgeAutoPush: false,
      bridgeAutoPr: false,
    };
    const parsed = parseCodeAgentWipExecutionV1(raw);
    expect(parsed?.commitSha).toBe("abc123");
    expect(parsed?.pushStatus).toBe("skipped");
    expect(parsed?.targetRepositorySnapshot?.repoFullName).toBe("pjryu0322/aiproject");
    expect(parsed?.bridgeAllowedPathGlobs).toEqual(["src/**"]);
    expect(parsed?.bridgeAutoPush).toBe(false);
  });

  it("parseCodeAgentWipExecutionV1 preserves selectedTaskId and selectedWorkItemIds", () => {
    const taskId = plan.items[0]?.id ?? "";
    const wip = {
      ...buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems, selectedTaskId: taskId }),
      selectedWorkItemIds: [workItems[0]?.id ?? "wi-1"],
    };
    const parsed = parseCodeAgentWipExecutionV1(wip);
    expect(parsed?.selectedTaskId).toBe(taskId);
    expect(parsed?.selectedWorkItemIds).toEqual([workItems[0]?.id ?? "wi-1"]);
  });

  it("buildDeveloperApproveWipResult preserves selectedTaskId on approved wip", () => {
    const taskId = plan.items[0]?.id ?? "";
    const scopedWorkItems = workItems.filter((w) => w.taskId === taskId);
    const requested = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems: scopedWorkItems.length ? scopedWorkItems : workItems,
      existingWip: undefined,
      selectedTaskId: taskId,
    });
    if (requested.kind !== "created") throw new Error("expected created");
    const approved = buildDeveloperApproveWipResult({
      requirementsStateJson: {},
      wip: requested.orchestrationPatch.codeAgentWipExecutionV1,
    });
    if (approved.kind !== "approved") throw new Error("expected approved");
    expect(approved.orchestrationPatch.codeAgentWipExecutionV1.selectedTaskId).toBe(taskId);
  });

  it("persists codeAgentWipExecutionV1 in requirements state json", () => {
    const wip = buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems });
    const parsed = parseRequirementsStateJson({ codeAgentWipExecutionV1: wip });
    expect(parsed.codeAgentWipExecutionV1?.branchName).toBe(wip.branchName);
    expect(parseCodeAgentWipExecutionV1(wip)?.projectId).toBe("p1");
  });

  it("maps 코드 에이전트 WIP 작업 요청 chip to stage action", () => {
    expect(mapImplementationChipToAction(CODE_AGENT_WIP_WORK_REQUEST_CHIP)).toBe("REQUEST_CODE_AGENT_WIP");
  });

  it("maps legacy Cursor WIP chip to the same stage action", () => {
    expect(mapImplementationChipToAction(LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP)).toBe("REQUEST_CODE_AGENT_WIP");
  });

  it("approves developer result and requests SCM official commit", () => {
    const taskId = plan.items[0]?.id ?? "";
    const scopedWorkItems = workItems.filter((w) => w.taskId === taskId);
    const requested = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems: scopedWorkItems.length ? scopedWorkItems : workItems,
      existingWip: undefined,
      selectedTaskId: taskId,
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

  it("REQUEST_CODE_AGENT_WIP selectedTaskId is used in branch name and commit title", () => {
    const result = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems: workItems.filter((w) => w.taskId === plan.items[1]?.id || w.taskId === plan.items[0]?.id),
      existingWip: undefined,
      selectedTaskId: plan.items[1]?.id ?? plan.items[0]?.id,
      selectedWorkItemIds: workItems
        .filter((w) => w.taskId === (plan.items[1]?.id ?? plan.items[0]?.id))
        .map((w) => w.id),
    });
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    const taskId = plan.items[1]?.id ?? plan.items[0]?.id ?? "";
    const wip = result.orchestrationPatch.codeAgentWipExecutionV1;
    expect(wip.selectedTaskId).toBe(taskId);
    expect(wip.branchName).toContain(
      taskId.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 48),
    );
    expect(wip.commits[0]?.commitMessage).toContain(`[${taskId}]`);
    expect(wip.commits[0]?.taskId).toBe(taskId);
  });

  it("REQUEST_CODE_AGENT_WIP blocks when selectedWorkItems taskId mismatches selectedTaskId", () => {
    const result = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems,
      existingWip: undefined,
      selectedTaskId: "dev-mismatch",
    });
    expect(result.kind).toBe("blocked");
    if (result.kind !== "blocked") return;
    expect(result.message).toContain("일치하지 않습니다");
  });

  it("stub execution message contains WIP 초안 and not WIP 작업을 완료했습니다", () => {
    const result = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems,
      existingWip: undefined,
      selectedTaskId: plan.items[0]?.id,
      totalCandidateCount: 14,
    });
    if (result.kind !== "created") throw new Error("expected created");
    const review = result.chatPatch.messages.at(-1);
    expect(review?.content).toContain("WIP 초안");
    expect(review?.content).toContain("실제 Cursor Bridge: 미연결");
    expect(review?.content).not.toContain("WIP 작업을 완료했습니다");
    expect(review?.content).toContain("stub validation: passed");
    expect(review?.content).toContain("이번 요청 대상:");
    expect(review?.content).toContain(plan.items[0]?.id ?? "");
  });

  it("parseCodeAgentWipExecutionV1 preserves executionMode and bridgeExecutionStatus", () => {
    const wip = {
      ...buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems }),
      executionMode: "stub" as const,
      bridgeExecutionStatus: "draft_created" as const,
    };
    const parsed = parseCodeAgentWipExecutionV1(wip);
    expect(parsed?.executionMode).toBe("stub");
    expect(parsed?.bridgeExecutionStatus).toBe("draft_created");
  });

  it("stub execution chips contain WIP 초안 승인 and Cursor 실행 요청", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "stub",
      bridgeExecutionStatus: "draft_created",
    });
    const chips = deriveCodeAgentWipReviewChips(wip);
    expect(chips).toContain(CODE_AGENT_WIP_DRAFT_APPROVE_CHIP);
    expect(chips).toContain(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP);
    expect(chips).not.toContain("구현 결과 승인");
  });

  it("draft_created chips include 환경설정 열기 when bridge disabled", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "stub",
      bridgeExecutionStatus: "draft_created",
      selectedTaskId: plan.items[0]?.id,
    });
    const chips = deriveCodeAgentWipReviewChips(wip);
    expect(chips).toContain("환경설정 열기");
    expect(chips.indexOf(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP)).toBeLessThan(
      chips.indexOf(CODE_AGENT_WIP_DRAFT_APPROVE_CHIP),
    );
  });

  it("buildImplementationWipDraftLifecycleTimelineEntry records draft lifecycle metadata", () => {
    const entry = buildImplementationWipDraftLifecycleTimelineEntry({
      action: "implementation_wip_draft_created",
      projectId: "p1",
      selectedTaskId: "DEV-001",
      selectedWorkItemCount: 2,
      bridgeEnabled: false,
    });
    expect(entry.action).toBe("implementation_wip_draft_created");
    expect(entry.responseText).toContain("selectedTaskId=DEV-001");
    expect(entry.responseText).toContain("selectedWorkItemCount=2");
    expect(entry.responseText).toContain("bridgeEnabled=no");
    expect(entry.responseText).toContain("executionStatus=draft_created");
  });

  it("draft_approved diagnostic shows WIP 초안 승인됨", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "stub",
      bridgeExecutionStatus: "draft_approved",
      selectedTaskId: plan.items[0]?.id,
    });
    const lines = formatCodeAgentExecutionModeDiagnosticLines(wip);
    expect(lines.join("\n")).toContain("WIP 초안 승인됨");
    expect(lines.join("\n")).not.toContain("WIP 초안 생성됨");
  });

  it("board diagnostic does not show WIP 초안 없음 after draft_created", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "stub",
      bridgeExecutionStatus: "draft_created",
      selectedTaskId: plan.items[0]?.id,
    });
    const lines = formatCodeAgentExecutionModeDiagnosticLines(wip);
    const text = lines.join("\n");
    expect(text).not.toContain("WIP 초안 없음");
    expect(text).toContain(plan.items[0]?.id ?? "");
  });

  it("approveDeveloperResult accepts executionStatus=draft_created", () => {
    const taskId = plan.items[0]?.id ?? "";
    const scopedWorkItems = workItems.filter((w) => w.taskId === taskId);
    const requested = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems: scopedWorkItems,
      existingWip: undefined,
      selectedTaskId: taskId,
    });
    if (requested.kind !== "created") throw new Error("expected created");
    const wip = requested.orchestrationPatch.codeAgentWipExecutionV1;
    expect(wip.bridgeExecutionStatus).toBe("draft_created");
    const gate = evaluateDeveloperApprovalGate(wip);
    expect(gate.allowed).toBe(true);
    const precheck = describeDeveloperApprovalPrecheck(wip);
    expect(precheck.title).toContain("WIP 초안");
  });

  it("draft_created approval updates executionStatus to draft_approved", () => {
    const taskId = plan.items[0]?.id ?? "";
    const scopedWorkItems = workItems.filter((w) => w.taskId === taskId);
    const requested = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems: scopedWorkItems,
      existingWip: undefined,
      selectedTaskId: taskId,
    });
    if (requested.kind !== "created") throw new Error("expected created");
    const approved = buildDeveloperApproveWipResult({
      requirementsStateJson: {},
      wip: requested.orchestrationPatch.codeAgentWipExecutionV1,
    });
    if (approved.kind !== "approved") throw new Error("expected approved");
    expect(approved.orchestrationPatch.codeAgentWipExecutionV1.bridgeExecutionStatus).toBe("draft_approved");
    expect(approved.chatPatch.messages.at(-1)?.content).toContain("WIP 초안을 승인");
  });

  it("board readiness summary shows stub mode when bridge unavailable", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "stub",
      bridgeExecutionStatus: "draft_created",
    });
    const lines = formatCodeAgentExecutionModeDiagnosticLines(wip);
    expect(lines.join("\n")).toContain("WIP 초안 생성됨");
    expect(lines.join("\n")).toContain("미연결");
  });

  it("bridge_completed message may contain WIP 작업이 완료되었습니다", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "cursor_bridge",
      bridgeExecutionStatus: "bridge_completed",
    });
    const taskId = plan.items[0]?.id ?? "unknown";
    const commit = {
      provider: "cursor" as const,
      branchName: wip.branchName,
      commitMessage: `wip(cursor): [${taskId}] test`,
      taskId,
      workItemId: workItems[0]?.id ?? "wi-1",
      changedFiles: ["a.ts"],
      diffSummary: ["ok"],
      testResults: ["pnpm test: passed"],
      unresolvedIssues: [],
      createdAt: "2026-05-28T00:00:00.000Z",
    };
    const msg = buildCodeAgentWipExecutionMessage({
      wip,
      commit,
      selectedTaskId: taskId,
      selectedWorkItems: workItems.filter((w) => w.taskId === taskId),
    });
    expect(msg.content).toContain("Cursor Bridge가 대상 프로젝트 저장소에 실제 소스를 생성했습니다");
  });
});
