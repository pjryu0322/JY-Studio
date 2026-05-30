import { describe, expect, it } from "vitest";
import {
  appendWipPolicyToCodeAgentPrompt,
  buildCodeAgentWipDraftCreatedTimelineEntry,
  buildCodeAgentWipDraftFailedTimelineEntry,
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
  isRealCursorSourceGenerationCompleted,
  LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP,
  mapBlockedMessageToWipDraftFailureReason,
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
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.executionStatus).toBe("draft_created");
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.selectedTaskId).toBeTruthy();
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.selectedWorkItemIds?.length).toBeGreaterThan(0);
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.branchName).toBeTruthy();
    expect(String(result.orchestrationPatch.codeAgentWipExecutionV1.commits[0]?.sha ?? "")).toMatch(/^wip-stub-/);
  });

  it("duplicate REQUEST_CODE_AGENT_WIP does not create a second draft", () => {
    const first = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems,
      existingWip: undefined,
    });
    expect(first.kind).toBe("created");
    if (first.kind !== "created") return;
    const second = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems,
      existingWip: first.orchestrationPatch.codeAgentWipExecutionV1,
    });
    expect(second.kind).toBe("already_active");
  });

  it("buildCodeAgentWipDraftCreatedTimelineEntry records draft_created metadata", () => {
    const created = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems,
      existingWip: undefined,
    });
    if (created.kind !== "created") throw new Error("expected created");
    const entry = buildCodeAgentWipDraftCreatedTimelineEntry({
      projectId: "p1",
      wip: created.orchestrationPatch.codeAgentWipExecutionV1,
      runId: "impl-run-001",
    });
    expect(entry.action).toBe("code_agent_wip_draft_created");
    expect(entry.responseText).toContain("executionStatus=draft_created");
    expect(entry.responseText).toContain("cursorApiExecuted=false");
    expect(entry.responseText).toContain("runId=impl-run-001");
  });

  it("buildCodeAgentWipDraftFailedTimelineEntry maps blocked messages to reason", () => {
    const reason = mapBlockedMessageToWipDraftFailureReason("실행 가능한 개발자 작업이 없습니다.");
    expect(reason).toBe("missing_executable_developer_task");
    const entry = buildCodeAgentWipDraftFailedTimelineEntry({
      projectId: "p1",
      reason,
      runId: "impl-run-002",
      detail: "실행 가능한 개발자 작업이 없습니다.",
    });
    expect(entry.action).toBe("code_agent_wip_draft_failed");
    expect(entry.responseText).toContain("reason=missing_executable_developer_task");
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

  it("REQUEST_CODE_AGENT_WIP returns codeAgentWipExecutionV1 with draft metadata", () => {
    const taskId = plan.items[0]?.id ?? "";
    const scopedWorkItems = workItems.filter((w) => w.taskId === taskId);
    const result = buildRequestCodeAgentWipWorkResult({
      projectId: "p1",
      requirementsStateJson: {},
      plan,
      workItems: scopedWorkItems,
      existingWip: undefined,
      selectedTaskId: taskId,
    });
    if (result.kind !== "created") throw new Error("expected created");
    const wip = result.orchestrationPatch.codeAgentWipExecutionV1;
    expect(wip.executionMode).toBe("stub");
    expect(wip.bridgeExecutionStatus).toBe("draft_created");
    expect(wip.executionStatus).toBe("draft_created");
    expect(wip.bridgeAdapter).toBe("cursor_api");
    expect(wip.selectedTaskId).toBe(taskId);
    expect(wip.selectedWorkItemIds?.length).toBeGreaterThan(0);
    expect(wip.commits[0]?.sha).toMatch(/^wip-stub-/);
    expect(wip.commits[0]?.testResults).toContain("실제 Cursor API 실행: 미실행");
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

  it("maps Cursor 실행 요청 chip to REQUEST_CURSOR_BRIDGE_EXECUTION", () => {
    expect(mapImplementationChipToAction(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP)).toBe(
      "REQUEST_CURSOR_BRIDGE_EXECUTION",
    );
    expect(mapImplementationChipToAction("Cursor 실행 요청")).toBe("REQUEST_CURSOR_BRIDGE_EXECUTION");
    expect(mapImplementationChipToAction(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP)).not.toBe(
      "REQUEST_CODE_AGENT_WIP",
    );
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
    expect(scm.orchestrationPatch.codeAgentWipExecutionV1.platformScmExecutionV1?.pushStatus).toBe(
      "push_requested",
    );
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
    expect(review?.content).toContain("실제 Cursor API: 미설정");
    expect(review?.content).not.toContain("WIP 작업을 완료했습니다");
    expect(review?.content).toContain("stub validation: passed");
    expect(review?.content).toContain("실제 Cursor API 실행: 미실행");
    expect(review?.content).toContain("이번 요청 대상:");
    expect(review?.content).toContain(plan.items[0]?.id ?? "");
  });

  it("parseCodeAgentWipExecutionV1 preserves platformScmExecutionV1", () => {
    const wip = {
      ...buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems }),
      platformScmExecutionV1: {
        version: "platform_scm_execution_v1",
        projectId: "p1",
        selectedTaskId: "dev-1",
        sourceCommitSha: "abc123",
        sourceBranchName: "wip/cursor/dev-1",
        targetRepository: "owner/repo",
        pushStatus: "pending",
        createdAt: "2026-05-30T00:00:00.000Z",
        updatedAt: "2026-05-30T00:00:00.000Z",
      },
      cursorExternalPushStatus: "success",
      cursorExternalPrNumber: 9,
    };
    const parsed = parseCodeAgentWipExecutionV1(wip);
    expect(parsed?.platformScmExecutionV1?.pushStatus).toBe("pending");
    expect(parsed?.cursorExternalPushStatus).toBe("success");
    expect(parsed?.cursorExternalPrNumber).toBe(9);
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
    expect(entry.responseText).toContain("cursorApiReady=no");
    expect(entry.responseText).toContain("bridgeAdapter=cursor_api");
    expect(entry.responseText).toContain("hasCodeAgentWipExecutionV1=yes");
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
    expect(lines.join("\n")).toContain("미설정");
  });

  it("bridge_completed message may contain WIP 작업이 완료되었습니다", () => {
    const taskId = plan.items[0]?.id ?? "unknown";
    const commit = {
      provider: "cursor" as const,
      sha: "abc123def4567890",
      branchName: "wip/cursor/dev-1",
      commitMessage: `wip(cursor): [${taskId}] test`,
      taskId,
      workItemId: workItems[0]?.id ?? "wi-1",
      changedFiles: ["a.ts"],
      diffSummary: ["ok"],
      testResults: ["pnpm test: passed"],
      unresolvedIssues: [],
      createdAt: "2026-05-28T00:00:00.000Z",
    };
    const wip = {
      ...buildInitialCodeAgentWipExecution({
        projectId: "p1",
        plan,
        workItems,
        executionMode: "cursor_api",
        bridgeExecutionStatus: "bridge_completed",
      }),
      commits: [commit],
      commitSha: commit.sha,
    };
    const msg = buildCodeAgentWipExecutionMessage({
      wip,
      commit,
      selectedTaskId: taskId,
      selectedWorkItems: workItems.filter((w) => w.taskId === taskId),
    });
    expect(msg.content).toContain("Cursor API가 대상 프로젝트 저장소에 실제 소스를 생성했습니다");
  });
});

describe("isRealCursorSourceGenerationCompleted", () => {
  const plan = buildImplementationTaskPlan({
    projectId: "p1",
    projectArtifacts: [],
    featureDraftTitles: ["upload"],
    envOk: true,
    designOk: true,
  });
  const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

  function completedWip(overrides: Partial<import("@/lib/prototype/codeAgentWipExecution").CodeAgentWipExecutionV1> = {}) {
    const wip = buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems });
    return {
      ...wip,
      executionMode: "cursor_api" as const,
      bridgeAdapter: "cursor_api" as const,
      bridgeExecutionStatus: "bridge_completed" as const,
      commits: [
        {
          provider: "cursor" as const,
          sha: "abc123def4567890",
          branchName: wip.branchName,
          commitMessage: "wip",
          taskId: "dev-1",
          workItemId: "wi-1",
          changedFiles: ["src/App.tsx"],
          diffSummary: [],
          testResults: [],
          unresolvedIssues: [],
          createdAt: "2026-05-29T12:00:00.000Z",
        },
      ],
      ...overrides,
    };
  }

  it("returns true for cursor_api with real commit and changedFiles", () => {
    expect(isRealCursorSourceGenerationCompleted(completedWip())).toBe(true);
  });

  it("returns false without commitSha", () => {
    expect(
      isRealCursorSourceGenerationCompleted(
        completedWip({ commits: [], commitSha: undefined }),
      ),
    ).toBe(false);
  });

  it("returns false for wip-stub sha", () => {
    const wip = completedWip();
    expect(
      isRealCursorSourceGenerationCompleted({
        ...wip,
        commits: [{ ...wip.commits[0]!, sha: "wip-stub-1" }],
      }),
    ).toBe(false);
  });

  it("returns false without changedFiles", () => {
    const wip = completedWip();
    expect(
      isRealCursorSourceGenerationCompleted({
        ...wip,
        commits: [{ ...wip.commits[0]!, changedFiles: [] }],
      }),
    ).toBe(false);
  });

  it("returns false when only bridgeAdapter is set without real commit", () => {
    expect(
      isRealCursorSourceGenerationCompleted({
        ...completedWip({ commits: [], commitSha: undefined }),
        bridgeAdapter: "cursor_api",
      }),
    ).toBe(false);
  });
});
