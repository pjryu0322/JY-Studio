"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RolePermissions } from "@/lib/auth/roles";
import {
  fetchExecutionRuns,
  fetchExecutionSetup,
  fetchGeneratedTasks,
  fetchProjectById,
  fetchExecutionLoopStatus,
  postExecutionLoopRun,
  type ExecutionSetupDto,
  type TaskExecutionRunDto,
} from "@/components/project-spec/api";
import { ProjectSpecPageHeader } from "@/components/project-spec/ProjectSpecPageHeader";
import { ProjectSpecPageStatus } from "@/components/project-spec/ProjectSpecPageStatus";
import { ProjectSpecWorkspace } from "@/components/project-spec/ProjectSpecWorkspace";
import { Project, TaskItem } from "@/components/project-spec/types";
import {
  GitChangeRequestItem,
  TaskFollowUpDraft,
  TaskListSection,
  TaskPromptItem,
  TaskRunItem,
} from "@/components/task/TaskListSection";
import { TaskHistoryItem, TaskHistoryTimeline } from "@/components/task/TaskHistoryTimeline";
import { formatTestedAt } from "@/components/project-spec/format";
import { ProjectMembersSummaryPanel } from "@/components/project-spec/ProjectMembersSummaryPanel";
import type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";
import {
  canEditSpec,
  canManageMembers,
  canOperate,
  canReview,
} from "@/lib/rbac/projectPermissions";
import type { ProjectRole } from "@/lib/rbac/projectPermissions";
import { ExecutionObservabilityPanel } from "@/components/dashboard/ExecutionObservabilityPanel";
import type { ProjectObservabilitySnapshot } from "@/lib/metrics/projectObservabilityTypes";
import { RBAC_FORBIDDEN_CODE } from "@/lib/rbac/projectAccessDenied";
import {
  GIT_APPROVAL_MODE_MANUAL_APPROVAL,
  GIT_APPROVAL_MODE_NO_APPROVAL,
  GIT_PUSH_MODE_AUTO_PUSH,
  GIT_PUSH_MODE_MANUAL_PUSH,
  normalizeGitApprovalModeForDisplay,
} from "@/lib/git-apply/retry";
import { ProjectDetailGearMenu } from "@/components/project/ProjectDetailGearMenu";
import { ExecutionEnvironmentBlockedModal } from "@/components/project/ExecutionEnvironmentBlockedModal";
import { ProjectExecutionReadinessSummary } from "@/components/project/ProjectExecutionReadinessSummary";
import {
  computeProjectExecutionReadiness,
  isExecutionEnvironmentFailureMessage,
} from "@/components/project/projectExecutionReadinessModel";
// ProjectGuidedFlowPanel(단계 체크리스트)은 프로젝트 상세 실행 계획 화면에서 제거했습니다.
import { ExecutionTimeline } from "@/components/git/ExecutionTimeline";
import {
  isGitBranchConfigErrorMessage,
  stripGitBranchConfigMarkerForDisplay,
} from "@/lib/execution/gitBranchCursorError";
import { projectExecutionSettingsHref } from "@/lib/project/projectExecutionSettingsHref";
import { isRequirementsPendingWorkflow } from "@/lib/project/projectWorkflowStatus";
import { REQUIREMENTS_ANALYSIS_INCOMPLETE_REDIRECT_MESSAGE_KR } from "@/lib/project/requirementsAnalysisGate";

function rbacForbiddenMessage(
  res: Response,
  json: { code?: string; message?: string }
): string | null {
  if (res.status === 403 && json.code === RBAC_FORBIDDEN_CODE && json.message) {
    return json.message;
  }
  return null;
}

type ProjectMainTab = "overview" | "members";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceView = searchParams.get("view");
  const projectId = typeof params?.projectId === "string" ? params.projectId : "";
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskPrompts, setTaskPrompts] = useState<TaskPromptItem[]>([]);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);
  const [generatingPromptTaskId, setGeneratingPromptTaskId] = useState<string | null>(null);
  const [taskRuns, setTaskRuns] = useState<TaskRunItem[]>([]);
  const [runningPromptId, setRunningPromptId] = useState<string | null>(null);
  const [orchestrationRunningTaskId, setOrchestrationRunningTaskId] = useState<string | null>(null);
  const [markingReadyTaskId, setMarkingReadyTaskId] = useState<string | null>(null);
  const [loadingTaskPrompts, setLoadingTaskPrompts] = useState(false);
  const [loadingTaskRuns, setLoadingTaskRuns] = useState(false);
  const [gitRequests, setGitRequests] = useState<GitChangeRequestItem[]>([]);
  const [loadingGitRequests, setLoadingGitRequests] = useState(false);
  const [registeringGitRequestRunId, setRegisteringGitRequestRunId] = useState<string | null>(null);
  const [applyingGitRequestId, setApplyingGitRequestId] = useState<string | null>(null);
  const [gitApplyMode, setGitApplyMode] = useState<"mock" | "cursor" | "git">("mock");
  const [gitApplyPushOption, setGitApplyPushOption] = useState(false);
  const [gitApplySimulateFailure, setGitApplySimulateFailure] = useState(false);
  const [gitApplyMessage, setGitApplyMessage] = useState<string | null>(null);
  const [gitApplyError, setGitApplyError] = useState<string | null>(null);
  const [gitPrBusyId, setGitPrBusyId] = useState<string | null>(null);
  const [gitPolicySaving, setGitPolicySaving] = useState(false);
  const [gitRejectReasons, setGitRejectReasons] = useState<Record<string, string>>({});
  const [auditTaskId, setAuditTaskId] = useState<string | null>(null);
  const [auditHistory, setAuditHistory] = useState<TaskHistoryItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [abortingTaskId, setAbortingTaskId] = useState<string | null>(null);
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null);
  const [unblockingTaskId, setUnblockingTaskId] = useState<string | null>(null);
  const [forceCompletingTaskId, setForceCompletingTaskId] = useState<string | null>(null);
  const [followUpDraft, setFollowUpDraft] = useState<TaskFollowUpDraft | null>(null);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [execSummary, setExecSummary] = useState<ProjectObservabilitySnapshot | null>(null);
  const [execSummaryLoading, setExecSummaryLoading] = useState(false);
  const [execSummaryError, setExecSummaryError] = useState<string | null>(null);
  const [executionRuns, setExecutionRuns] = useState<TaskExecutionRunDto[]>([]);
  const [executionRunsLoading, setExecutionRunsLoading] = useState(false);
  const [executionRunsError, setExecutionRunsError] = useState<string | null>(null);
  const [executionSafeMode, setExecutionSafeMode] = useState(false);
  const [mainTab, setMainTab] = useState<ProjectMainTab>("overview");
  const [execSetupValidatedHint, setExecSetupValidatedHint] = useState<boolean | null>(null);
  const [executionSetupOverview, setExecutionSetupOverview] = useState<ExecutionSetupDto | null>(null);
  const [executionSetupOverviewLoading, setExecutionSetupOverviewLoading] = useState(false);
  const [executionLoopBusy, setExecutionLoopBusy] = useState(false);
  const [executionLoopBanner, setExecutionLoopBanner] = useState<string | null>(null);
  const [executionLoopPaused, setExecutionLoopPaused] = useState(false);
  const [envBlockedModalOpen, setEnvBlockedModalOpen] = useState(false);
  const [singleExecutionTaskId, setSingleExecutionTaskId] = useState("");
  const [approvingSensitiveTaskId, setApprovingSensitiveTaskId] = useState<string | null>(null);

  const [projectRole, setProjectRole] = useState<ProjectRole | null>(null);
  const [memberRows, setMemberRows] = useState<ProjectMemberUiRow[]>([]);
  const permissions = useMemo(
    () =>
      projectRole
        ? RolePermissions[projectRole]
        : {
            canViewProject: false,
            canEditProject: false,
            canGenerateTask: false,
            canRunTask: false,
            canReorderTask: false,
            canCreatePrompt: false,
            canRegisterGitRequest: false,
            canApplyGit: false,
            canReviewGit: false,
            canChangeGitPolicy: false,
            canViewExecution: false,
            canControlExecution: false,
            canRequestAiMemberAction: false,
            canRequestAiReviewAction: false,
            canDispatchAiMemberAction: false,
          },
    [projectRole]
  );
  const uiPermissions = useMemo(
    () => ({
      canRun: permissions.canRunTask,
      canApprove: permissions.canReviewGit,
      canReorder: permissions.canReorderTask,
    }),
    [permissions.canReorderTask, permissions.canReviewGit, permissions.canRunTask]
  );

  type AiMemberActionOverviewRow = {
    taskId: string | null;
    gitChangeRequestId: string | null;
    actionType: string;
    status: string;
    reviewStatus: string | null;
    applyStatus: string;
    requestedAt: string;
  };
  const [aiMemberActionsOverview, setAiMemberActionsOverview] = useState<AiMemberActionOverviewRow[]>([]);

  const rbac = useMemo(
    () => ({
      canEditSpec: canEditSpec(projectRole),
      canReview: canReview(projectRole),
      canOperate: canOperate(projectRole),
      canManageMembers: canManageMembers(projectRole),
    }),
    [projectRole]
  );
  const showTaskSection = rbac.canReview || rbac.canOperate || rbac.canEditSpec;

  useEffect(() => {
    if (!projectId || !permissions.canViewProject) {
      setAiMemberActionsOverview([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/ai-member-actions?projectId=${encodeURIComponent(projectId)}`,
        { credentials: "include" }
      );
      const json = (await res.json()) as {
        success?: boolean;
        data?: AiMemberActionOverviewRow[];
      };
      if (cancelled || !res.ok || !json.success || !Array.isArray(json.data)) {
        return;
      }
      setAiMemberActionsOverview(json.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, permissions.canViewProject, tasks.length, gitRequests.length]);

  const aiMemberTaskHints = useMemo(() => {
    const latest = new Map<string, { at: string; label: string }>();
    for (const a of aiMemberActionsOverview) {
      if (!a.taskId) continue;
      const label = `AI: ${a.actionType} · 검토 ${a.reviewStatus ?? "—"} · 적용 ${a.applyStatus}`;
      const prev = latest.get(a.taskId);
      if (!prev || a.requestedAt > prev.at) {
        latest.set(a.taskId, { at: a.requestedAt, label });
      }
    }
    return Object.fromEntries([...latest.entries()].map(([k, v]) => [k, v.label]));
  }, [aiMemberActionsOverview]);

  const aiMemberGitHints = useMemo(() => {
    const latest = new Map<string, { at: string; label: string }>();
    for (const a of aiMemberActionsOverview) {
      if (!a.gitChangeRequestId) continue;
      const label = `AI: ${a.actionType} · 검토 ${a.reviewStatus ?? "—"} · 적용 ${a.applyStatus}`;
      const prev = latest.get(a.gitChangeRequestId);
      if (!prev || a.requestedAt > prev.at) {
        latest.set(a.gitChangeRequestId, { at: a.requestedAt, label });
      }
    }
    return Object.fromEntries([...latest.entries()].map(([k, v]) => [k, v.label]));
  }, [aiMemberActionsOverview]);

  const orchestrationTaskOverview = useMemo(() => {
    const primary = tasks.filter((t) => t.taskKind === "PRIMARY");
    const running = primary.find((t) => t.executionWorkflowStatus === "running");
    const pendingGitReflection = primary.find((t) => t.executionWorkflowStatus === "pending_apply");
    const ready = primary
      .filter((t) => t.status === "TODO" && t.executionWorkflowStatus === "ready")
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const awaitingHuman = primary.filter((t) => t.executionWorkflowStatus === "awaiting_human");
    const failed = [...primary]
      .filter((t) => t.executionWorkflowStatus === "failed")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      running,
      pendingGitReflection,
      nextReady: ready[0],
      awaitingHuman,
      lastFailed: failed[0] ?? null,
    };
  }, [tasks]);

  const partitionedCursorRuns = useMemo(() => {
    const active: TaskExecutionRunDto[] = [];
    const historical: TaskExecutionRunDto[] = [];
    for (const r of executionRuns) {
      if (r.archivedAt) {
        historical.push(r);
      } else {
        active.push(r);
      }
    }
    return { active, historical };
  }, [executionRuns]);

  const reloadSessionContext = useCallback(async () => {
    if (!projectId) {
      setProjectRole(null);
      setMemberRows([]);
      return;
    }
    const res = await fetch(`/api/project/session-context?projectId=${encodeURIComponent(projectId)}`, {
      credentials: "include",
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: {
        myRole: ProjectRole | null;
        members: ProjectMemberUiRow[];
      };
    };
    if (!res.ok || !json.success || !json.data) {
      setProjectRole(null);
      setMemberRows([]);
      return;
    }
    setProjectRole(json.data.myRole);
    setMemberRows(Array.isArray(json.data.members) ? json.data.members : []);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await reloadSessionContext();
      } catch {
        if (!cancelled) {
          setProjectRole(null);
          setMemberRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadSessionContext]);

  useEffect(() => {
    if (!projectId) return;
    if (workspaceView === "workspace") return;
    router.replace(`/requirements?projectId=${encodeURIComponent(projectId)}`);
  }, [projectId, workspaceView, router]);

  useEffect(() => {
    if (!projectId || loading || !project) return;
    if (!isRequirementsPendingWorkflow(project.workflowStatus)) return;
    if (workspaceView !== "workspace") return;
    const notice = encodeURIComponent(REQUIREMENTS_ANALYSIS_INCOMPLETE_REDIRECT_MESSAGE_KR);
    router.replace(`/requirements?projectId=${encodeURIComponent(projectId)}&workflowNotice=${notice}`);
  }, [projectId, loading, project, router, workspaceView]);

  useEffect(() => {
    if (!project) {
      return;
    }
    const pushMode = String(project.gitPushMode ?? GIT_PUSH_MODE_AUTO_PUSH).trim();
    setGitApplyPushOption(
      pushMode === GIT_PUSH_MODE_AUTO_PUSH || pushMode === ""
    );
  }, [project]);

  useEffect(() => {
    if (!projectId || !uiPermissions.canRun) {
      setExecSummary(null);
      setExecSummaryError(null);
      setExecSummaryLoading(false);
      return;
    }

    let cancelled = false;

    async function loadExecutionSummary() {
      setExecSummaryLoading(true);
      setExecSummaryError(null);
      try {
        const encoded = encodeURIComponent(projectId);
        const res = await fetch(`/api/project/summary?projectId=${encoded}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          success: boolean;
          message?: string;
          code?: string;
          data?: ProjectObservabilitySnapshot;
        };
        if (cancelled) {
          return;
        }
        const denied = rbacForbiddenMessage(res, json);
        if (denied) {
          setExecSummaryError(denied);
          setExecSummary(null);
          return;
        }
        if (!res.ok || !json.success || !json.data) {
          setExecSummaryError(json.message || "실행 요약을 불러오지 못했습니다.");
          setExecSummary(null);
          return;
        }
        setExecSummary(json.data);
      } catch (error) {
        console.error("Failed to load execution summary:", error);
        if (!cancelled) {
          setExecSummaryError("실행 요약 조회 중 오류가 발생했습니다.");
          setExecSummary(null);
        }
      } finally {
        if (!cancelled) {
          setExecSummaryLoading(false);
        }
      }
    }

    void loadExecutionSummary();
    return () => {
      cancelled = true;
    };
  }, [projectId, uiPermissions.canRun]);

  useEffect(() => {
    let cancelled = false;
    async function loadRuntimeFlags() {
      try {
        const res = await fetch("/api/config/runtime");
        const json = (await res.json()) as {
          success?: boolean;
          data?: { executionSafeMode?: boolean };
        };
        if (!cancelled && json.success && json.data?.executionSafeMode === true) {
          setExecutionSafeMode(true);
        }
      } catch {
        /* ignore */
      }
    }
    void loadRuntimeFlags();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId) return;

    async function loadProjectDetail() {
      try {
        setLoading(true);
        setErrorMessage(null);
        const result = await fetchProjectById(projectId);
        setProject(result.project);
        setErrorMessage(result.errorMessage);
      } catch (error) {
        console.error("Failed to load project detail:", error);
        setProject(null);
        setErrorMessage("프로젝트 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    async function loadTasks() {
      try {
        setLoadingTasks(true);
        const { res, json } = await fetchGeneratedTasks(projectId);
        const denied = rbacForbiddenMessage(res, json);
        if (denied) {
          setErrorMessage(denied);
          return;
        }
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          return;
        }
        setTasks(json.data);
      } catch (error) {
        console.error("Failed to load generated tasks:", error);
      } finally {
        setLoadingTasks(false);
      }
    }

    async function loadTaskPrompts() {
      try {
        setLoadingTaskPrompts(true);
        const encodedProjectId = encodeURIComponent(projectId);
        const res = await fetch(`/api/task/prompt?projectId=${encodedProjectId}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          success: boolean;
          code?: string;
          message?: string;
          data?: TaskPromptItem[];
        };
        const denied = rbacForbiddenMessage(res, json);
        if (denied) {
          setErrorMessage(denied);
          return;
        }
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          return;
        }
        setTaskPrompts(json.data);
      } catch (error) {
        console.error("Failed to load task prompts:", error);
      } finally {
        setLoadingTaskPrompts(false);
      }
    }

    async function loadTaskRuns() {
      try {
        setLoadingTaskRuns(true);
        const encodedProjectId = encodeURIComponent(projectId);
        const res = await fetch(`/api/task/run?projectId=${encodedProjectId}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          success: boolean;
          code?: string;
          message?: string;
          data?: TaskRunItem[];
        };
        const denied = rbacForbiddenMessage(res, json);
        if (denied) {
          setErrorMessage(denied);
          return;
        }
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          return;
        }
        setTaskRuns(json.data);
      } catch (error) {
        console.error("Failed to load task runs:", error);
      } finally {
        setLoadingTaskRuns(false);
      }
    }

    async function loadGitRequests() {
      try {
        setLoadingGitRequests(true);
        const encodedProjectId = encodeURIComponent(projectId);
        const res = await fetch(`/api/task/git-apply?projectId=${encodedProjectId}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          success: boolean;
          data?: GitChangeRequestItem[];
          code?: string;
          message?: string;
        };
        const denied = rbacForbiddenMessage(res, json);
        if (denied) {
          setErrorMessage(denied);
          return;
        }
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          return;
        }
        setGitRequests(json.data);
      } catch (error) {
        console.error("Failed to load git change requests:", error);
      } finally {
        setLoadingGitRequests(false);
      }
    }

    loadProjectDetail();
    loadTasks();
    loadTaskPrompts();
    loadTaskRuns();
    loadGitRequests();
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !auditTaskId) {
      setAuditHistory([]);
      setAuditError(null);
      return;
    }

    const historyProjectId = projectId;
    const historyTaskId = auditTaskId;

    async function loadHistory() {
      try {
        setAuditLoading(true);
        setAuditError(null);
        const encodedTask = encodeURIComponent(historyTaskId);
        const encodedProject = encodeURIComponent(historyProjectId);
        const res = await fetch(
          `/api/task/history?taskId=${encodedTask}&projectId=${encodedProject}`,
          { credentials: "include" }
        );
        const json = (await res.json()) as {
          success: boolean;
          message?: string;
          code?: string;
          data?: TaskHistoryItem[];
        };
        const denied = rbacForbiddenMessage(res, json);
        if (denied) {
          setAuditError(denied);
          setAuditHistory([]);
          return;
        }
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          setAuditError(json.message || "이력을 불러오지 못했습니다.");
          setAuditHistory([]);
          return;
        }
        setAuditHistory(json.data);
      } catch (error) {
        console.error("Failed to load task history:", error);
        setAuditError("이력 조회 중 오류가 발생했습니다.");
        setAuditHistory([]);
      } finally {
        setAuditLoading(false);
      }
    }

    void loadHistory();
  }, [projectId, auditTaskId]);

  const taskPromptMap = useMemo(
    () =>
      taskPrompts.reduce<Record<string, TaskPromptItem>>((acc, item) => {
        acc[item.taskId] = item;
        return acc;
      }, {}),
    [taskPrompts]
  );

  const taskRunMap = useMemo(
    () =>
      taskRuns.reduce<Record<string, TaskRunItem>>((acc, item) => {
        acc[item.taskId] = item;
        return acc;
      }, {}),
    [taskRuns]
  );

  const reloadTaskRuns = useCallback(async () => {
    if (!projectId) {
      return;
    }
    try {
      const encodedProjectId = encodeURIComponent(projectId);
      const runRes = await fetch(`/api/task/run?projectId=${encodedProjectId}`, {
        credentials: "include",
      });
      const runJson = (await runRes.json()) as { success: boolean; data?: TaskRunItem[] };
      if (runRes.ok && runJson.success && Array.isArray(runJson.data)) {
        setTaskRuns(runJson.data);
      }
    } catch (error) {
      console.error("Failed to reload task runs:", error);
    }
  }, [projectId]);

  const reloadTasksList = useCallback(async () => {
    if (!projectId) {
      return;
    }
    try {
      const { res, json } = await fetchGeneratedTasks(projectId);
      const denied = rbacForbiddenMessage(res, json as { code?: string; message?: string });
      if (denied) {
        setErrorMessage(denied);
        return;
      }
      if (res.ok && json.success && Array.isArray(json.data)) {
        setTasks(json.data);
      }
    } catch (error) {
      console.error("Failed to reload tasks:", error);
    }
  }, [projectId]);

  const refreshTasksAfterDraftGenerate = useCallback(async () => {
    await reloadTasksList();
    await reloadTaskRuns();
  }, [reloadTasksList, reloadTaskRuns]);

  // 확정된 Spec 버전이 바뀌면 (스펙->Task 매핑이 달라지므로) confirmed Task 목록도 반드시 갱신한다.
  useEffect(() => {
    if (!projectId) return;
    void reloadTasksList();
    void reloadTaskRuns();
  }, [projectId, project?.currentSpecVersionId, reloadTasksList, reloadTaskRuns]);

  const loadExecutionRuns = useCallback(async () => {
    if (!projectId || !permissions.canViewProject) {
      setExecutionRuns([]);
      setExecutionRunsLoading(false);
      setExecutionRunsError(null);
      return;
    }
    setExecutionRunsLoading(true);
    setExecutionRunsError(null);
    try {
      const { res, json } = await fetchExecutionRuns(projectId, { take: 15 });
      const denied = rbacForbiddenMessage(res, json as { code?: string; message?: string });
      if (denied) {
        setExecutionRunsError(denied);
        setExecutionRuns([]);
        return;
      }
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setExecutionRunsError(json.message || "실행 기록을 불러오지 못했습니다.");
        setExecutionRuns([]);
        return;
      }
      setExecutionRuns(json.data);
    } catch {
      setExecutionRunsError("실행 기록 조회 중 오류가 발생했습니다.");
      setExecutionRuns([]);
    } finally {
      setExecutionRunsLoading(false);
    }
  }, [projectId, permissions.canViewProject]);

  useEffect(() => {
    void loadExecutionRuns();
  }, [loadExecutionRuns]);

  const handleApproveSensitiveWorkflow = useCallback(
    async (taskId: string) => {
      setApprovingSensitiveTaskId(taskId);
      try {
        const res = await fetch("/api/task/control", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, action: "workflow-approve-sensitive" }),
        });
        const json = (await res.json()) as { success?: boolean; message?: string; code?: string };
        const denied = rbacForbiddenMessage(res, json);
        if (denied) {
          setErrorMessage(denied);
          return;
        }
        if (!res.ok || !json.success) {
          setExecutionLoopBanner(json.message ?? "민감 작업 승인에 실패했습니다.");
          return;
        }
        setExecutionLoopBanner(json.message ?? "민감 작업이 승인되었습니다.");
        await reloadTasksList();
      } catch (e) {
        console.error(e);
        setExecutionLoopBanner("민감 작업 승인 요청 중 오류가 발생했습니다.");
      } finally {
        setApprovingSensitiveTaskId(null);
      }
    },
    [reloadTasksList]
  );

  const refreshExecutionLoopPaused = useCallback(async () => {
    if (!projectId || !uiPermissions.canRun) return;
    const { res, json } = await fetchExecutionLoopStatus(projectId);
    const denied = rbacForbiddenMessage(res, json as { code?: string; message?: string });
    if (denied) return;
    if (res.ok && json.success && json.data && typeof json.data.paused === "boolean") {
      setExecutionLoopPaused(json.data.paused);
    }
  }, [projectId, uiPermissions.canRun]);

  const navigateToExecutionSettings = useCallback(
    (opts?: { envNote?: string | null }) => {
      if (!projectId) return;
      setEnvBlockedModalOpen(false);
      const note = opts?.envNote != null ? String(opts.envNote).trim() : "";
      router.push(
        projectExecutionSettingsHref(projectId, {
          from: "planning",
          envNote: note || undefined,
        })
      );
    },
    [projectId, router]
  );

  const handlePauseExecutionLoop = useCallback(async () => {
    if (!projectId) return;
    const { res, json } = await postExecutionLoopRun(projectId, { action: "pause" });
    const denied = rbacForbiddenMessage(res, json as { code?: string; message?: string });
    if (denied) {
      setErrorMessage(denied);
      return;
    }
    if (res.ok && json.success) {
      setExecutionLoopPaused(true);
      setExecutionLoopBanner(json.message ?? "일시정지 요청됨.");
    }
  }, [projectId]);

  const handleResumeExecutionLoop = useCallback(async () => {
    if (!projectId) return;
    const { res, json } = await postExecutionLoopRun(projectId, { action: "resume" });
    const denied = rbacForbiddenMessage(res, json as { code?: string; message?: string });
    if (denied) {
      setErrorMessage(denied);
      return;
    }
    if (res.ok && json.success) {
      setExecutionLoopPaused(false);
      setExecutionLoopBanner(json.message ?? "재개됨.");
    }
  }, [projectId]);

  const handleAbortExecutionLoop = useCallback(async () => {
    if (!projectId) return;
    const { res, json } = await postExecutionLoopRun(projectId, { action: "pause" });
    const denied = rbacForbiddenMessage(res, json as { code?: string; message?: string });
    if (denied) {
      setErrorMessage(denied);
      return;
    }
    if (res.ok && json.success) {
      setExecutionLoopPaused(true);
      setExecutionLoopBanner(
        "중단 요청: 실행 루프는 다음 체크포인트에서 멈춥니다. 진행 중인 Cursor 호출은 끝날 때까지 이어질 수 있습니다."
      );
    }
  }, [projectId]);

  const runExecutionLoopPrimary = useCallback(async () => {
    if (!projectId) return;
    setExecutionLoopBusy(true);
    setExecutionLoopBanner(null);
    try {
      const tid = singleExecutionTaskId.trim();
      const { res, json } = await postExecutionLoopRun(projectId, tid ? { taskId: tid } : undefined);
      const denied = rbacForbiddenMessage(res, json as { code?: string; message?: string });
      if (denied) {
        setErrorMessage(denied);
        return;
      }
      if (!res.ok || !json.success) {
        const m =
          json.message ??
          "실행 루프를 완료하지 못했습니다. (Cursor API 키·Task 상태·선행 DAG를 확인하세요.)";
        setErrorMessage(m);
        setExecutionLoopBanner(m);
        if (isExecutionEnvironmentFailureMessage(m)) {
          navigateToExecutionSettings({ envNote: m });
        }
        await reloadTasksList();
        await loadExecutionRuns();
        return;
      }
      setErrorMessage(null);
      setExecutionLoopBanner(json.message ?? "실행 루프가 완료되었습니다.");
      await reloadTasksList();
      await loadExecutionRuns();
    } catch (e) {
      console.error("execution loop:", e);
      setExecutionLoopBanner("실행 루프 요청 중 오류가 발생했습니다.");
    } finally {
      setExecutionLoopBusy(false);
      void refreshExecutionLoopPaused();
    }
  }, [
    projectId,
    singleExecutionTaskId,
    reloadTasksList,
    loadExecutionRuns,
    refreshExecutionLoopPaused,
    navigateToExecutionSettings,
  ]);

  const startExecutionFromPlanning = useCallback(() => {
    if (execSetupValidatedHint !== true) {
      setEnvBlockedModalOpen(true);
      return;
    }
    void runExecutionLoopPrimary();
  }, [execSetupValidatedHint, runExecutionLoopPrimary]);

  useEffect(() => {
    if (!projectId || !uiPermissions.canRun) return;
    void refreshExecutionLoopPaused();
  }, [projectId, uiPermissions.canRun, refreshExecutionLoopPaused]);

  useEffect(() => {
    if (!projectId || !uiPermissions.canRun) return;
    const id = window.setInterval(() => {
      void reloadTasksList();
      void reloadTaskRuns();
      void refreshExecutionLoopPaused();
    }, 4500);
    return () => window.clearInterval(id);
  }, [projectId, uiPermissions.canRun, reloadTasksList, reloadTaskRuns, refreshExecutionLoopPaused]);

  useEffect(() => {
    if (!projectId || !permissions.canViewProject) {
      setExecutionSetupOverview(null);
      setExecutionSetupOverviewLoading(false);
      setExecSetupValidatedHint(null);
      return;
    }
    let cancelled = false;
    setExecutionSetupOverviewLoading(true);
    void (async () => {
      const { res, json } = await fetchExecutionSetup(projectId);
      if (cancelled) return;
      setExecutionSetupOverviewLoading(false);
      if (res.ok && json.success && json.data) {
        setExecutionSetupOverview(json.data);
        if (uiPermissions.canRun) {
          setExecSetupValidatedHint(computeProjectExecutionReadiness(json.data).runnable);
        } else {
          setExecSetupValidatedHint(null);
        }
      } else {
        setExecutionSetupOverview(null);
        if (uiPermissions.canRun) {
          setExecSetupValidatedHint(false);
        } else {
          setExecSetupValidatedHint(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, permissions.canViewProject, uiPermissions.canRun]);

  async function handleGenerateTaskPrompt(taskId: string) {
    try {
      setGeneratingPromptTaskId(taskId);
      setPromptMessage(null);

      const res = await fetch("/api/task/prompt", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      });

      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
        data?: TaskPromptItem;
      };

      if (!res.ok || !json.success || !json.data) {
        setPromptMessage(json.message || "Task 프롬프트 생성 요청에 실패했습니다.");
        return;
      }
      const encodedProjectId = encodeURIComponent(projectId);
      const promptRes = await fetch(`/api/task/prompt?projectId=${encodedProjectId}`, {
        credentials: "include",
      });
      const promptJson = (await promptRes.json()) as { success: boolean; data?: TaskPromptItem[] };
      if (promptRes.ok && promptJson.success && Array.isArray(promptJson.data)) {
        setTaskPrompts(promptJson.data);
      } else {
        setTaskPrompts((prev) => {
          const filtered = prev.filter((item) => item.taskId !== json.data!.taskId);
          return [json.data!, ...filtered];
        });
      }
      setPromptMessage(json.message || "Task 실행 프롬프트가 생성되었습니다.");
    } catch (error) {
      console.error("Failed to generate task prompt:", error);
      setPromptMessage("Task 프롬프트 생성 중 오류가 발생했습니다.");
    } finally {
      setGeneratingPromptTaskId(null);
    }
  }

  async function handleRunTask(taskId: string) {
    if (!projectId) return;

    if (execSetupValidatedHint === true) {
      try {
        setOrchestrationRunningTaskId(taskId);
        setExecutionLoopBusy(true);
        setPromptMessage(null);
        setExecutionLoopBanner(null);

        const { res, json } = await postExecutionLoopRun(projectId, { taskId });
        const denied = rbacForbiddenMessage(res, json as { code?: string; message?: string });
        if (denied) {
          setErrorMessage(denied);
          return;
        }

        setExecutionLoopBanner(
          json.message ?? (json.success ? "실행이 완료되었습니다." : "실행이 중단되었습니다.")
        );
        setPromptMessage(
          json.message ??
            (json.success ? "Cursor 실행 및 검토 단계가 반영되었습니다." : "실행에 실패했습니다.")
        );
        if (
          !json.success &&
          isExecutionEnvironmentFailureMessage(
            typeof json.message === "string" ? json.message : undefined
          )
        ) {
          navigateToExecutionSettings({
            envNote: typeof json.message === "string" ? json.message : "실행 환경을 확인하세요.",
          });
        }
        await reloadTasksList();
        await loadExecutionRuns();
        await reloadTaskRuns();
      } catch (error) {
        console.error("handleRunTask (orchestration):", error);
        setPromptMessage("Cursor 실행 루프 요청 중 오류가 발생했습니다.");
      } finally {
        setOrchestrationRunningTaskId(null);
        setExecutionLoopBusy(false);
      }
      return;
    }

    const prompt = taskPromptMap[taskId];
    if (!prompt) {
      const msg =
        execSetupValidatedHint === false
          ? "Cursor 파이프라인을 쓰려면 프로젝트 관리 → 설정에서 연결·검증을 완료하거나, mock 실행을 위해 프롬프트를 생성하세요."
          : "먼저 프롬프트를 생성해 주세요.";
      setPromptMessage(msg);
      if (execSetupValidatedHint === false) {
        navigateToExecutionSettings({ envNote: msg });
      }
      return;
    }

    try {
      setRunningPromptId(prompt.id);
      setPromptMessage(null);

      const res = await fetch("/api/task/run", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskPromptId: prompt.id }),
      });

      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
        data?: TaskRunItem;
      };

      if (!res.ok || !json.success || !json.data) {
        const detail =
          json.code && json.message
            ? `${json.message} (${json.code})`
            : json.message || "Task 실행 요청에 실패했습니다.";
        setPromptMessage(detail);
        return;
      }
      await reloadTaskRuns();
      setPromptMessage(json.message || "Task mock 실행이 완료되었습니다.");
    } catch (error) {
      console.error("Failed to run task:", error);
      setPromptMessage("Task 실행 중 오류가 발생했습니다.");
    } finally {
      setRunningPromptId(null);
    }
  }

  async function handleMarkReadyForGit(taskId: string) {
    const prompt = taskPromptMap[taskId];
    if (!prompt) {
      setPromptMessage("먼저 프롬프트를 생성해 주세요.");
      return;
    }

    try {
      setMarkingReadyTaskId(taskId);
      setPromptMessage(null);

      const res = await fetch("/api/task/run", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskPromptId: prompt.id, action: "mark-ready-for-git" }),
      });

      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
        data?: TaskRunItem;
      };

      if (!res.ok || !json.success || !json.data) {
        setPromptMessage(json.message || "READY_FOR_GIT 전환에 실패했습니다.");
        return;
      }

      await reloadTaskRuns();
      setPromptMessage(json.message || "TaskRun이 READY_FOR_GIT 상태로 전환되었습니다.");
    } catch (error) {
      console.error("Failed to mark task run ready for git:", error);
      setPromptMessage("READY_FOR_GIT 전환 중 오류가 발생했습니다.");
    } finally {
      setMarkingReadyTaskId(null);
    }
  }

  async function handleReorderTasks(orderedTaskIds: string[]) {
    if (!projectId || orderedTaskIds.length !== tasks.length) {
      return;
    }
    const prevTasks = tasks;
    const byId = new Map(tasks.map((t) => [t.id, t] as const));
    const optimistic = orderedTaskIds.map((id, order) => {
      const row = byId.get(id);
      return row ? { ...row, order } : null;
    });
    if (optimistic.some((row) => row === null)) {
      return;
    }
    setTasks(optimistic as TaskItem[]);
    try {
      setReorderSaving(true);
      const res = await fetch("/api/task/reorder", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId, orderedTaskIds }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
        data?: TaskItem[];
      };
      if (!res.ok || !json.success) {
        setTasks(prevTasks);
        setPromptMessage(json.message || "Task 순서 저장에 실패했습니다.");
        return;
      }
      if (Array.isArray(json.data)) {
        setTasks(json.data);
      }
      setPromptMessage(json.message || "Task 순서가 저장되었습니다.");
    } catch (error) {
      console.error("Failed to reorder tasks:", error);
      setTasks(prevTasks);
      setPromptMessage("Task 순서 저장 중 오류가 발생했습니다.");
    } finally {
      setReorderSaving(false);
    }
  }

  async function handleAbortRun(taskId: string) {
    const prompt = taskPromptMap[taskId];
    if (!prompt) {
      setPromptMessage("먼저 프롬프트를 생성해 주세요.");
      return;
    }
    try {
      setAbortingTaskId(taskId);
      setPromptMessage(null);
      const res = await fetch("/api/task/run", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskPromptId: prompt.id, action: "abort-run" }),
      });
      const json = (await res.json()) as { success: boolean; message?: string; code?: string };
      if (!res.ok || !json.success) {
        setPromptMessage(json.message || "실행 중단에 실패했습니다.");
        return;
      }
      await reloadTaskRuns();
      await reloadTasksList();
      setPromptMessage(json.message || "실행이 중단되었습니다.");
    } catch (error) {
      console.error("Failed to abort task run:", error);
      setPromptMessage("실행 중단 중 오류가 발생했습니다.");
    } finally {
      setAbortingTaskId(null);
    }
  }

  async function handleForceCompleteRun(taskId: string) {
    try {
      setForceCompletingTaskId(taskId);
      setPromptMessage(null);
      const res = await fetch("/api/task/control", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId, action: "force-complete-latest" }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
        data?: { task: TaskItem; taskRun?: TaskRunItem };
      };
      if (!res.ok || !json.success) {
        setPromptMessage(json.message || "강제 완료 처리에 실패했습니다.");
        return;
      }
      if (json.data?.task) {
        setTasks((prev) => prev.map((t) => (t.id === json.data!.task.id ? json.data!.task : t)));
      }
      await reloadTaskRuns();
      setPromptMessage(json.message || "최신 Run을 DONE으로 전환했습니다.");
    } catch (error) {
      console.error("Failed to force-complete task run:", error);
      setPromptMessage("강제 완료 처리 중 오류가 발생했습니다.");
    } finally {
      setForceCompletingTaskId(null);
    }
  }

  async function handleBlockTask(taskId: string) {
    try {
      setBlockingTaskId(taskId);
      setPromptMessage(null);
      const res = await fetch("/api/task/control", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId, action: "block" }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
        data?: { task: TaskItem };
      };
      if (!res.ok || !json.success) {
        setPromptMessage(json.message || "차단 처리에 실패했습니다.");
        return;
      }
      if (json.data?.task) {
        setTasks((prev) => prev.map((t) => (t.id === json.data!.task.id ? json.data!.task : t)));
      }
      setPromptMessage(json.message || "Task를 차단했습니다.");
    } catch (error) {
      console.error("Failed to block task:", error);
      setPromptMessage("차단 처리 중 오류가 발생했습니다.");
    } finally {
      setBlockingTaskId(null);
    }
  }

  async function handleUnblockTask(taskId: string) {
    try {
      setUnblockingTaskId(taskId);
      setPromptMessage(null);
      const res = await fetch("/api/task/control", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId, action: "unblock" }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
        data?: { task: TaskItem };
      };
      if (!res.ok || !json.success) {
        setPromptMessage(json.message || "차단 해제에 실패했습니다.");
        return;
      }
      if (json.data?.task) {
        setTasks((prev) => prev.map((t) => (t.id === json.data!.task.id ? json.data!.task : t)));
      }
      setPromptMessage(json.message || "차단을 해제했습니다.");
    } catch (error) {
      console.error("Failed to unblock task:", error);
      setPromptMessage("차단 해제 중 오류가 발생했습니다.");
    } finally {
      setUnblockingTaskId(null);
    }
  }

  function handleRequestFollowUp(taskId: string) {
    const t = tasks.find((x) => x.id === taskId);
    setFollowUpDraft({
      sourceTaskId: taskId,
      name: t ? `${t.name} (보완)` : "보완 작업",
      description: "",
      changeReason: "",
    });
  }

  async function handleSubmitFollowUp() {
    if (!projectId || !followUpDraft) {
      return;
    }
    if (!followUpDraft.changeReason.trim()) {
      setPromptMessage("변경 사유를 입력해 주세요.");
      return;
    }
    try {
      setFollowUpSaving(true);
      setPromptMessage(null);
      const res = await fetch("/api/task/follow-up", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          sourceTaskId: followUpDraft.sourceTaskId,
          name: followUpDraft.name,
          description: followUpDraft.description.trim() || null,
          changeReason: followUpDraft.changeReason,
        }),
      });
      const json = (await res.json()) as { success: boolean; message?: string; code?: string };
      if (!res.ok || !json.success) {
        setPromptMessage(json.message || "보완 작업 생성에 실패했습니다.");
        return;
      }
      setFollowUpDraft(null);
      setPromptMessage(json.message || "보완 작업이 생성되었습니다.");
      await reloadTasksList();
    } catch (error) {
      console.error("Failed to create follow-up task:", error);
      setPromptMessage("보완 작업 생성 중 오류가 발생했습니다.");
    } finally {
      setFollowUpSaving(false);
    }
  }

  async function handleRegisterGitRequest(taskId: string) {
    const run = taskRunMap[taskId];
    if (!run) {
      setPromptMessage("요청 등록 대상 TaskRun을 찾을 수 없습니다.");
      return;
    }

    try {
      setRegisteringGitRequestRunId(run.id);
      setPromptMessage(null);

      const res = await fetch("/api/task/git-request", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskRunId: run.id }),
      });

      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
      };

      if (!res.ok || !json.success) {
        const detail =
          json.code && json.message
            ? `${json.message} (${json.code})`
            : json.message || "Git 반영 요청 등록에 실패했습니다.";
        setPromptMessage(detail);
        return;
      }

      const encodedProjectId = encodeURIComponent(projectId);
      const listRes = await fetch(`/api/task/git-apply?projectId=${encodedProjectId}`, {
        credentials: "include",
      });
      const listJson = (await listRes.json()) as {
        success: boolean;
        data?: GitChangeRequestItem[];
      };
      if (listRes.ok && listJson.success && Array.isArray(listJson.data)) {
        setGitRequests(listJson.data);
      }

      setPromptMessage(json.message || "Git 반영 요청이 등록되었습니다.");
    } catch (error) {
      console.error("Failed to register git change request:", error);
      setPromptMessage("Git 반영 요청 등록 중 오류가 발생했습니다.");
    } finally {
      setRegisteringGitRequestRunId(null);
    }
  }

  async function refreshGitRequestsList() {
    const encodedProjectId = encodeURIComponent(projectId);
    const listRes = await fetch(`/api/task/git-apply?projectId=${encodedProjectId}`, {
      credentials: "include",
    });
    const listJson = (await listRes.json()) as {
      success: boolean;
      data?: GitChangeRequestItem[];
    };
    if (listRes.ok && listJson.success && Array.isArray(listJson.data)) {
      setGitRequests(listJson.data);
    }
  }

  function applyLogHasGitPushOk(log: string | null | undefined): boolean {
    return Boolean(log && log.includes("[GIT] push OK"));
  }

  function extractGithubPrCreateFailureLine(log: string | null | undefined): string | null {
    if (!log?.includes("[GIT] PR create failed")) {
      return null;
    }
    const hit = log
      .split("\n")
      .filter((line) => line.includes("[GIT] PR create failed"))
      .pop();
    return hit?.trim() ?? null;
  }

  function formatPrMergeSummary(item: GitChangeRequestItem): string {
    if (item.mergedAt) {
      return formatTestedAt(item.mergedAt);
    }
    if (String(item.pullRequestState ?? "").toUpperCase() === "MERGED") {
      return "병합됨";
    }
    return "아직 아님";
  }

  async function handleGitHubPrAction(gitChangeRequestId: string, action: "create" | "sync") {
    try {
      setGitPrBusyId(gitChangeRequestId);
      setGitApplyMessage(null);
      setGitApplyError(null);
      const manualPush =
        String(project?.gitPushMode ?? GIT_PUSH_MODE_AUTO_PUSH).trim() ===
        GIT_PUSH_MODE_MANUAL_PUSH;

      let res: Response;
      if (action === "sync") {
        const q = new URLSearchParams({ gitChangeRequestId });
        res = await fetch(`/api/git/pr/status?${q.toString()}`, {
          credentials: "include",
        });
      } else {
        res = await fetch("/api/task/git-pr", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            gitChangeRequestId,
            action: "create",
            relaxAutoPushPolicy: manualPush,
          }),
        });
      }

      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
      };
      await refreshGitRequestsList();
      if (!res.ok || !json.success) {
        const detail =
          json.code && json.message
            ? `${json.message} (${json.code})`
            : json.message || "GitHub PR 처리에 실패했습니다.";
        setGitApplyError(detail);
        return;
      }
      setGitApplyMessage(
        json.message ||
          (action === "sync" ? "PR 상태를 동기화했습니다." : "Pull Request를 생성했습니다.")
      );
    } catch (error) {
      console.error("GitHub PR action failed:", error);
      setGitApplyError("GitHub PR 처리 중 오류가 발생했습니다.");
    } finally {
      setGitPrBusyId(null);
    }
  }

  function isManualGitItem(item: GitChangeRequestItem): boolean {
    return (
      String(item.gitApprovalMode ?? GIT_APPROVAL_MODE_NO_APPROVAL).trim() ===
      GIT_APPROVAL_MODE_MANUAL_APPROVAL
    );
  }

  async function handlePatchGitPolicy(e: ChangeEvent<HTMLSelectElement>) {
    const mode = e.target.value;
    if (!projectId || !project) {
      return;
    }
    setGitPolicySaving(true);
    setGitApplyError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ gitApprovalMode: mode }),
        }
      );
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
      };
      if (!res.ok || !json.success) {
        setGitApplyError(json.message || "Git 반영 정책 저장에 실패했습니다.");
        return;
      }
      setProject((p) => (p ? { ...p, gitApprovalMode: mode } : null));
      await refreshGitRequestsList();
    } catch (error) {
      console.error("Failed to patch git approval mode:", error);
      setGitApplyError("Git 반영 정책 저장 중 오류가 발생했습니다.");
    } finally {
      setGitPolicySaving(false);
    }
  }

  async function handlePatchGitPushMode(e: ChangeEvent<HTMLSelectElement>) {
    const mode = e.target.value;
    if (!projectId || !project) {
      return;
    }
    setGitPolicySaving(true);
    setGitApplyError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ gitPushMode: mode }),
        }
      );
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
      };
      if (!res.ok || !json.success) {
        setGitApplyError(json.message || "Git push 정책 저장에 실패했습니다.");
        return;
      }
      setProject((p) => (p ? { ...p, gitPushMode: mode } : null));
      await refreshGitRequestsList();
    } catch (error) {
      console.error("Failed to patch git push mode:", error);
      setGitApplyError("Git push 정책 저장 중 오류가 발생했습니다.");
    } finally {
      setGitPolicySaving(false);
    }
  }

  async function handleGitApprove(gitChangeRequestId: string) {
    try {
      setApplyingGitRequestId(gitChangeRequestId);
      setGitApplyMessage(null);
      setGitApplyError(null);
      const res = await fetch("/api/git/approve", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gitChangeRequestId }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
      };
      await refreshGitRequestsList();
      if (!res.ok || !json.success) {
        const detail =
          json.code && json.message
            ? `${json.message} (${json.code})`
            : json.message || "승인 처리에 실패했습니다.";
        setGitApplyError(detail);
        return;
      }
      setGitApplyMessage(json.message || "승인되었습니다.");
    } catch (error) {
      console.error("Failed to approve git request:", error);
      setGitApplyError("승인 처리 중 오류가 발생했습니다.");
    } finally {
      setApplyingGitRequestId(null);
    }
  }

  async function handleGitReject(gitChangeRequestId: string) {
    try {
      setApplyingGitRequestId(gitChangeRequestId);
      setGitApplyMessage(null);
      setGitApplyError(null);
      const reason = (gitRejectReasons[gitChangeRequestId] ?? "").trim() || undefined;
      const res = await fetch("/api/git/reject", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gitChangeRequestId, reason }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
      };
      await refreshGitRequestsList();
      if (!res.ok || !json.success) {
        const detail =
          json.code && json.message
            ? `${json.message} (${json.code})`
            : json.message || "반려 처리에 실패했습니다.";
        setGitApplyError(detail);
        return;
      }
      setGitApplyMessage(json.message || "반려되었습니다.");
    } catch (error) {
      console.error("Failed to reject git request:", error);
      setGitApplyError("반려 처리 중 오류가 발생했습니다.");
    } finally {
      setApplyingGitRequestId(null);
    }
  }

  async function handleGitResubmitApproval(gitChangeRequestId: string) {
    try {
      setApplyingGitRequestId(gitChangeRequestId);
      setGitApplyMessage(null);
      setGitApplyError(null);
      const res = await fetch("/api/git/submit-approval", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gitChangeRequestId }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
      };
      await refreshGitRequestsList();
      if (!res.ok || !json.success) {
        const detail =
          json.code && json.message
            ? `${json.message} (${json.code})`
            : json.message || "승인 재요청에 실패했습니다.";
        setGitApplyError(detail);
        return;
      }
      setGitApplyMessage(json.message || "승인 재요청이 접수되었습니다.");
    } catch (error) {
      console.error("Failed to resubmit git approval:", error);
      setGitApplyError("승인 재요청 중 오류가 발생했습니다.");
    } finally {
      setApplyingGitRequestId(null);
    }
  }

  async function handleApplyGitRequest(gitChangeRequestId: string) {
    try {
      setApplyingGitRequestId(gitChangeRequestId);
      setGitApplyMessage(null);
      setGitApplyError(null);

      const res = await fetch("/api/task/git-apply", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gitChangeRequestId,
          mode: gitApplyMode,
          options: {
            push: gitApplyPushOption,
            ...(gitApplyMode === "cursor"
              ? { simulateFailure: gitApplySimulateFailure }
              : {}),
          },
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
        prWarning?: string;
      };

      await refreshGitRequestsList();

      if (!res.ok || !json.success) {
        const detail =
          json.code && json.message
            ? `${json.message} (${json.code})`
            : json.message || "Git 반영 실행에 실패했습니다.";
        setGitApplyError(detail);
        setGitApplyMessage(null);
        return;
      }

      setGitApplyMessage(json.message || "Git 반영 실행이 완료되었습니다.");
      setGitApplyError(json.prWarning?.trim() ? json.prWarning : null);
    } catch (error) {
      console.error("Failed to apply git change request:", error);
      setGitApplyError("Git 반영 실행 중 오류가 발생했습니다.");
      setGitApplyMessage(null);
    } finally {
      setApplyingGitRequestId(null);
    }
  }

  const MAX_GIT_APPLY_RETRIES = 2;

  async function handleRetryGitApply(gitChangeRequestId: string) {
    try {
      setApplyingGitRequestId(gitChangeRequestId);
      setGitApplyMessage(null);
      setGitApplyError(null);

      const res = await fetch("/api/task/git-apply", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gitChangeRequestId,
          mode: gitApplyMode,
          retry: true,
          options: {
            push: gitApplyPushOption,
            ...(gitApplyMode === "cursor"
              ? { simulateFailure: gitApplySimulateFailure }
              : {}),
          },
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
        prWarning?: string;
      };

      await refreshGitRequestsList();

      if (!res.ok || !json.success) {
        const detail =
          json.code && json.message
            ? `${json.message} (${json.code})`
            : json.message || "Git 반영 재시도에 실패했습니다.";
        setGitApplyError(detail);
        setGitApplyMessage(null);
        return;
      }

      setGitApplyMessage(json.message || "Git 반영 재시도가 완료되었습니다.");
      setGitApplyError(json.prWarning?.trim() ? json.prWarning : null);
    } catch (error) {
      console.error("Failed to retry git change request:", error);
      setGitApplyError("Git 반영 재시도 중 오류가 발생했습니다.");
      setGitApplyMessage(null);
    } finally {
      setApplyingGitRequestId(null);
    }
  }

  const scrollToExecutionSetup = useCallback(() => {
    navigateToExecutionSettings();
  }, [navigateToExecutionSettings]);

  const projectFlowTail = (
    <>
      {showTaskSection ? (
        <div id="guided-flow-tasks" data-ui-label="[O-2] Execution Worker — Task Queue Runs Control">
        <div data-ui-label="[O-3] Self-Healing Flow — Follow-up Retry Abort Auto-Heal">
        {permissions.canViewProject || uiPermissions.canRun ? (
          <details
            style={{
              marginBottom: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "8px 12px",
              background: "#fafafa",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 14,
                color: "#334155",
                listStyle: "none",
              }}
            >
              상세 보기 ▾
            </summary>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {uiPermissions.canRun ? (
                <>
                  <ExecutionObservabilityPanel
                    data={execSummary}
                    loading={execSummaryLoading}
                    errorMessage={execSummaryError}
                    live={
                      uiPermissions.canRun
                        ? {
                            tasks,
                            taskRunMap,
                            loading: loadingTasks,
                            orchestration: {
                              running: orchestrationTaskOverview.running,
                              pendingGitReflection: orchestrationTaskOverview.pendingGitReflection,
                              nextReady: orchestrationTaskOverview.nextReady,
                              awaitingHuman: orchestrationTaskOverview.awaitingHuman,
                              lastFailed: orchestrationTaskOverview.lastFailed,
                            },
                            executionLoopBusy,
                            executionLoopPaused,
                            execSetupReady: execSetupValidatedHint === true,
                            executionLoopBanner,
                            onStartExecution: () => void startExecutionFromPlanning(),
                            onPauseLoop: handlePauseExecutionLoop,
                            onResumeLoop: handleResumeExecutionLoop,
                            onAbortLoop: handleAbortExecutionLoop,
                            onScrollToExecutionSetup: scrollToExecutionSetup,
                            execSetupSoftGate: true,
                            onExecSetupBlockedAttempt: () => setEnvBlockedModalOpen(true),
                            lastFailedIsGitBranchError: Boolean(
                              orchestrationTaskOverview.lastFailed &&
                                isGitBranchConfigErrorMessage(
                                  orchestrationTaskOverview.lastFailed.lastEvalSummary
                                )
                            ),
                          }
                        : null
                    }
                  />
                  <details
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "8px 10px",
                      background: "#fff",
                    }}
                  >
                    <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#334155" }}>
                      고급 · 단일 Task ID
                    </summary>
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#334155" }}>
                        <span>Task ID (단일 실행)</span>
                        <input
                          value={singleExecutionTaskId}
                          onChange={(e) => setSingleExecutionTaskId(e.target.value)}
                          placeholder="비우면 DAG 순서"
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", minWidth: 220 }}
                        />
                      </label>
                    </div>
                  </details>
                  {execSetupValidatedHint !== true ? (
                    <span style={{ fontSize: 13, color: "#b45309", lineHeight: 1.45 }}>
                      프로젝트 관리 → 설정에서 Execution setup을 저장하고 검증을 완료한 뒤 「실행 시작」을 사용할 수 있습니다.
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
                      DAG·정책·민감 승인은 Execution setup을 따릅니다.
                    </span>
                  )}
                </>
              ) : null}
              {permissions.canViewProject ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    fontSize: 12,
                    color: "#334155",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6, color: "#0f172a" }}>
                    최근 Cursor 실행 기록 · AI 리뷰
                  </div>
                  {executionRunsLoading ? (
                    <div style={{ color: "#64748b" }}>불러오는 중…</div>
                  ) : executionRunsError ? (
                    <div style={{ color: "#b91c1c" }}>{executionRunsError}</div>
                  ) : executionRuns.length === 0 ? (
                    <div style={{ color: "#64748b" }}>아직 기록이 없습니다.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {partitionedCursorRuns.active.length > 0 ? (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                          {partitionedCursorRuns.active.map((run) => {
                            const taskLabel =
                              tasks.find((t) => t.id === run.taskId)?.name ??
                              `Task ${run.taskId.slice(0, 8)}…`;
                            const steps = run.evaluationReviewerSteps ?? [];
                            return (
                              <li
                                key={run.id}
                                style={{
                                  border: "1px solid #f1f5f9",
                                  borderRadius: 8,
                                  padding: "8px 10px",
                                  background: "#fafafa",
                                }}
                              >
                            <div style={{ fontWeight: 700 }}>
                              {taskLabel}{" "}
                              <span style={{ fontWeight: 500, color: "#64748b" }}>
                                · {run.status}
                                {run.evaluationDecision ? ` · ${run.evaluationDecision}` : ""}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                              {run.createdAt} · branch {run.branchName ?? "—"}
                            </div>
                            {steps.length > 0 ? (
                              <ul style={{ margin: "8px 0 0 0", paddingLeft: 16, fontSize: 11, color: "#475569" }}>
                                {steps.map((s, i) => (
                                  <li key={`${run.id}-step-${i}`} style={{ marginBottom: 4 }}>
                                    <strong>{s.name}</strong> ({s.role}) · {s.model} ·{" "}
                                    <span style={{ fontWeight: 800 }}>{s.decision}</span>
                                    <div style={{ color: "#64748b", marginTop: 2 }}>{s.summary.slice(0, 280)}</div>
                                    {s.issues && s.issues.length > 0 ? (
                                      <ul style={{ margin: "4px 0 0 0", paddingLeft: 14, color: "#64748b" }}>
                                        {s.issues.slice(0, 8).map((iss, j) => (
                                          <li key={j}>{iss}</li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : run.evaluationReason?.startsWith("review_skipped:") ? (
                              <div style={{ fontSize: 11, color: "#475569", marginTop: 6, lineHeight: 1.45 }}>
                                <strong>AI 리뷰어 없음 (기본 실행 모드)</strong>
                                <div style={{ marginTop: 4, color: "#64748b" }}>리뷰 단계 생략됨 (AI 멤버 미설정)</div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                                멀티 리뷰어 단계 없음(이전 단일 평가·정책 전처리만 적용된 기록일 수 있음).
                              </div>
                            )}
                            {run.runError?.trim() ? (
                              <div
                                style={{
                                  marginTop: 8,
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  background: "#fff7ed",
                                  border: "1px solid #fed7aa",
                                  fontSize: 11,
                                  color: "#7c2d12",
                                  lineHeight: 1.5,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                <div style={{ fontWeight: 800, marginBottom: 4 }}>실행/오류 메시지</div>
                                {stripGitBranchConfigMarkerForDisplay(run.runError.trim())}
                                {isGitBranchConfigErrorMessage(run.runError) ? (
                                  <button
                                    type="button"
                                    onClick={() => scrollToExecutionSetup()}
                                    style={{
                                      display: "block",
                                      marginTop: 10,
                                      padding: "6px 12px",
                                      borderRadius: 8,
                                      border: "1px solid #ea580c",
                                      background: "#fff",
                                      fontWeight: 800,
                                      fontSize: 12,
                                      color: "#c2410c",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Git 설정 수정하기
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                        </ul>
                      ) : partitionedCursorRuns.historical.length > 0 ? (
                        <div style={{ color: "#64748b", fontSize: 12 }}>
                          현재 생성 준비·활성 Task에 대한 최근 Cursor 기록이 없습니다.
                        </div>
                      ) : null}
                      {partitionedCursorRuns.historical.length > 0 ? (
                        <>
                          <div style={{ fontWeight: 800, fontSize: 11, color: "#92400e", letterSpacing: "0.02em" }}>
                            보관 (이전 생성 준비 기준 Task 실행 기록)
                          </div>
                          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                            {partitionedCursorRuns.historical.map((run) => {
                              const taskLabel =
                                tasks.find((t) => t.id === run.taskId)?.name ??
                                `Task ${run.taskId.slice(0, 8)}…`;
                              const steps = run.evaluationReviewerSteps ?? [];
                              return (
                                <li
                                  key={`hist-${run.id}`}
                                  style={{
                                    border: "1px solid #fde68a",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    background: "#fffbeb",
                                  }}
                                >
                                  <div style={{ fontWeight: 700 }}>
                                    {taskLabel}{" "}
                                    <span style={{ fontWeight: 500, color: "#64748b" }}>
                                      · {run.status}
                                      {run.evaluationDecision ? ` · ${run.evaluationDecision}` : ""}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                    {run.createdAt} · branch {run.branchName ?? "—"}
                                  </div>
                                  {steps.length > 0 ? (
                                    <ul
                                      style={{ margin: "8px 0 0 0", paddingLeft: 16, fontSize: 11, color: "#475569" }}
                                    >
                                      {steps.map((s, i) => (
                                        <li key={`${run.id}-hstep-${i}`} style={{ marginBottom: 4 }}>
                                          <strong>{s.name}</strong> ({s.role}) · {s.model} ·{" "}
                                          <span style={{ fontWeight: 800 }}>{s.decision}</span>
                                          <div style={{ color: "#64748b", marginTop: 2 }}>{s.summary.slice(0, 280)}</div>
                                          {s.issues && s.issues.length > 0 ? (
                                            <ul style={{ margin: "4px 0 0 0", paddingLeft: 14, color: "#64748b" }}>
                                              {s.issues.slice(0, 8).map((iss, j) => (
                                                <li key={j}>{iss}</li>
                                              ))}
                                            </ul>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : run.evaluationReason?.startsWith("review_skipped:") ? (
                                    <div
                                      style={{ fontSize: 11, color: "#475569", marginTop: 6, lineHeight: 1.45 }}
                                    >
                                      <strong>AI 리뷰어 없음 (기본 실행 모드)</strong>
                                      <div style={{ marginTop: 4, color: "#64748b" }}>
                                        리뷰 단계 생략됨 (AI 멤버 미설정)
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                                      멀티 리뷰어 단계 없음(이전 단일 평가·정책 전처리만 적용된 기록일 수 있음).
                                    </div>
                                  )}
                                  {run.runError?.trim() ? (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        background: "#fff7ed",
                                        border: "1px solid #fed7aa",
                                        fontSize: 11,
                                        color: "#7c2d12",
                                        lineHeight: 1.5,
                                        whiteSpace: "pre-wrap",
                                      }}
                                    >
                                      <div style={{ fontWeight: 800, marginBottom: 4 }}>실행/오류 메시지</div>
                                      {stripGitBranchConfigMarkerForDisplay(run.runError.trim())}
                                    </div>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
        <details
          style={{
            marginTop: 4,
            borderTop: "1px solid #e5e5e5",
            paddingTop: 10,
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 15,
              color: "#0f172a",
              listStyle: "none",
            }}
          >
            전체 Task
          </summary>
          <TaskListSection
            tasks={tasks}
            loadingTasks={loadingTasks}
            loadingTaskPrompts={loadingTaskPrompts}
            loadingTaskRuns={loadingTaskRuns}
            promptMessage={promptMessage}
            generatingPromptTaskId={generatingPromptTaskId}
            taskPromptMap={taskPromptMap}
            runningPromptId={runningPromptId}
            markingReadyTaskId={markingReadyTaskId}
            registeringGitRequestRunId={registeringGitRequestRunId}
            taskRunMap={taskRunMap}
            canGeneratePrompt={rbac.canReview}
            canRunTask={uiPermissions.canRun}
            canMarkReadyForGit={uiPermissions.canRun}
            canRegisterGitRequest={uiPermissions.canRun}
            canReorderTasks={uiPermissions.canReorder}
            reorderSaving={reorderSaving}
            abortingTaskId={abortingTaskId}
            blockingTaskId={blockingTaskId}
            unblockingTaskId={unblockingTaskId}
            forceCompletingTaskId={forceCompletingTaskId}
            onGeneratePrompt={handleGenerateTaskPrompt}
            onRunTask={handleRunTask}
            onMarkReadyForGit={handleMarkReadyForGit}
            onRegisterGitRequest={handleRegisterGitRequest}
            onViewTaskHistory={(tid) => setAuditTaskId(tid)}
            onReorderTasks={handleReorderTasks}
            onAbortRun={handleAbortRun}
            onForceCompleteRun={handleForceCompleteRun}
            onBlockTask={handleBlockTask}
            onUnblockTask={handleUnblockTask}
            canCreateFollowUp={rbac.canReview}
            followUpDraft={followUpDraft}
            followUpSaving={followUpSaving}
            onRequestFollowUp={handleRequestFollowUp}
            onFollowUpDraftChange={setFollowUpDraft}
            onCancelFollowUp={() => setFollowUpDraft(null)}
            onSubmitFollowUp={() => void handleSubmitFollowUp()}
            aiMemberTaskHints={aiMemberTaskHints}
            canApproveSensitiveWorkflow={rbac.canOperate}
            onApproveSensitiveWorkflow={handleApproveSensitiveWorkflow}
            approvingSensitiveTaskId={approvingSensitiveTaskId}
            cursorExecutionReady={execSetupValidatedHint === true}
            executionLoopBusy={executionLoopBusy}
            orchestrationRunningTaskId={orchestrationRunningTaskId}
            advancedEmbed
          />
        </details>
        </div>
        </div>
      ) : null}
      {showTaskSection && auditTaskId ? (
        <TaskHistoryTimeline
          taskId={auditTaskId}
          taskName={tasks.find((t) => t.id === auditTaskId)?.name ?? null}
          items={auditHistory}
          loading={auditLoading}
          errorMessage={auditError}
          onClose={() => {
            setAuditTaskId(null);
            setAuditHistory([]);
            setAuditError(null);
          }}
        />
      ) : null}
      {uiPermissions.canRun ? (
        <section
          id="guided-flow-git"
          data-ui-label="[O-4] Git Apply Flow — Policy Requests Apply PR"
          style={{
            borderTop: "1px solid #e5e5e5",
            marginTop: 16,
            paddingTop: 12,
          }}
        >
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px 0" }}>Git 반영 요청 목록</h3>
        <div
          style={{
            marginBottom: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            fontSize: 14,
            color: "#333",
          }}
        >
          <span>
            <strong>승인 정책:</strong>{" "}
            {normalizeGitApprovalModeForDisplay(project?.gitApprovalMode) ===
            GIT_APPROVAL_MODE_MANUAL_APPROVAL
              ? "승인 필요 (MANUAL_APPROVAL)"
              : "승인 생략 (NO_APPROVAL)"}
          </span>
          {uiPermissions.canApprove ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#555" }}>변경</span>
              <select
                value={normalizeGitApprovalModeForDisplay(project?.gitApprovalMode)}
                onChange={handlePatchGitPolicy}
                disabled={gitPolicySaving}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ccc" }}
              >
                <option value={GIT_APPROVAL_MODE_NO_APPROVAL}>승인 생략</option>
                <option value={GIT_APPROVAL_MODE_MANUAL_APPROVAL}>승인 필요</option>
              </select>
            </label>
          ) : null}
          <span style={{ marginLeft: 8 }}>
            <strong>Push 정책:</strong>{" "}
            {String(project?.gitPushMode ?? GIT_PUSH_MODE_AUTO_PUSH).trim() ===
            GIT_PUSH_MODE_MANUAL_PUSH
              ? "수동 (MANUAL_PUSH)"
              : "자동 시도 (AUTO_PUSH)"}
          </span>
          {uiPermissions.canApprove ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#555" }}>push</span>
              <select
                value={
                  String(project?.gitPushMode ?? GIT_PUSH_MODE_AUTO_PUSH).trim() ||
                  GIT_PUSH_MODE_AUTO_PUSH
                }
                onChange={handlePatchGitPushMode}
                disabled={gitPolicySaving}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ccc" }}
              >
                <option value={GIT_PUSH_MODE_AUTO_PUSH}>자동 push 시도</option>
                <option value={GIT_PUSH_MODE_MANUAL_PUSH}>수동만</option>
              </select>
            </label>
          ) : null}
        </div>
        <div
          style={{
            marginBottom: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#333" }}>
            <span>실행 모드</span>
            <select
              value={gitApplyMode}
              onChange={(e) =>
                setGitApplyMode(e.target.value as "mock" | "cursor" | "git")
              }
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="mock">Mock 실행</option>
              <option value="cursor">Cursor 실행 (CLI·웹훅·스텁)</option>
              <option value="git">Git 실행</option>
            </select>
          </label>
          {gitApplyMode === "git" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#555" }}>
              <input
                type="checkbox"
                checked={gitApplyPushOption}
                onChange={(e) => setGitApplyPushOption(e.target.checked)}
              />
              원격 push 요청 (프로젝트 AUTO_PUSH면 기본 켜짐·해제 시 이번 실행만 생략 /{" "}
              GIT_APPLY_PUSH_ENABLED=true 일 때만 실제 push)
            </label>
          ) : null}
          {gitApplyMode === "cursor" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#555" }}>
              <input
                type="checkbox"
                checked={gitApplySimulateFailure}
                onChange={(e) => setGitApplySimulateFailure(e.target.checked)}
              />
              Cursor 실패 시뮬레이션 (simulateFailure)
            </label>
          ) : null}
        </div>
        {gitApplyMode === "cursor" ? (
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: 12,
              color: "#455a64",
              lineHeight: 1.55,
              padding: "8px 10px",
              background: "#eceff1",
              borderRadius: 8,
              border: "1px solid #cfd8dc",
            }}
          >
            <strong>Cursor CLI:</strong> 서버 env에서{" "}
            <code style={{ fontSize: 11 }}>ENABLE_CURSOR_EXECUTION=true</code>,{" "}
            <code>CURSOR_EXEC_MODE=cli</code>, <code>CURSOR_CLI_PATH</code>, <code>CURSOR_WORKDIR</code>, 선택{" "}
            <code>CURSOR_PAYLOAD_DIR</code>, <code>CURSOR_EXEC_TIMEOUT_MS</code>, <code>CURSOR_CLI_ARGS</code> 를
            설정하면 실제 프로세스가 실행됩니다. 미설정·비활성 시 웹훅 또는 스텁으로 폴백합니다.{" "}
            <code>JY_SAFE_MODE</code> 가 켜져 있으면 CLI·웹훅은 호출되지 않습니다. 실패 시{" "}
            <code>applyLog</code>의 <code>[CURSOR_EXECUTION_FAILED]</code>·<code>[CURSOR_HINT]</code> 를 확인하세요.
          </p>
        ) : null}
        <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
          <strong>모드 안내:</strong> Mock은 내부 시뮬레이션만 수행합니다. Cursor는 표준 페이로드로 CLI(선택)·웹훅·스텁
          경로를 사용합니다. Git은 로컬 저장소 반영 구조 검증 단계이며, 실제 원격 push는 기본 비활성입니다.
        </p>
        {gitApplyError ? (
          <p style={{ margin: "0 0 8px 0", color: "#b00020", fontSize: 14 }}>{gitApplyError}</p>
        ) : null}
        {gitApplyMessage ? (
          <p style={{ margin: "0 0 8px 0", color: "#0a7d2e", fontSize: 14 }}>{gitApplyMessage}</p>
        ) : null}
        {loadingGitRequests ? (
          <p style={{ margin: 0, color: "#555" }}>Git 반영 요청 목록을 불러오는 중...</p>
        ) : gitRequests.length === 0 ? (
          <p style={{ margin: 0, color: "#555" }}>아직 등록된 Git 반영 요청이 없습니다.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {gitRequests.map((item) => {
              const prCreateFailLine = extractGithubPrCreateFailureLine(item.applyLog);
              return (
              <div
                key={item.id}
                style={{
                  border:
                    item.applyStatus === "FAILED"
                      ? "1px solid #c62828"
                      : "1px solid #e0e0e0",
                  borderRadius: 8,
                  padding: 10,
                  background: item.applyStatus === "FAILED" ? "#fff8f8" : "#fff",
                }}
              >
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>task:</strong>{" "}
                  {tasks.find((task) => task.id === item.taskId)?.name || item.taskId}
                </p>
                {aiMemberGitHints[item.id] ? (
                  <p style={{ margin: "0 0 4px 0", fontSize: 12, color: "#0f766e", lineHeight: 1.45 }}>
                    <strong>AI 멤버 액션:</strong> {aiMemberGitHints[item.id]}
                  </p>
                ) : null}
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>taskRunId:</strong> {item.taskRunId}
                </p>
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>status:</strong> {item.status}
                </p>
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>commitMessage:</strong> {item.commitMessage || "-"}
                </p>
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>변경 파일 수:</strong> {Array.isArray(item.files) ? item.files.length : 0}
                </p>
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>diff:</strong> {item.diffText ? "있음" : "없음"}
                </p>
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>applyStatus:</strong>{" "}
                  <span
                    style={{
                      color: item.applyStatus === "FAILED" ? "#b00020" : undefined,
                      fontWeight: item.applyStatus === "FAILED" ? 600 : undefined,
                    }}
                  >
                    {item.applyStatus || "PENDING"}
                  </span>
                </p>
                {item.applyLog?.includes("[mode: cursor]") ? (
                  <p style={{ margin: "0 0 4px 0", fontSize: 12, color: "#4a148c", lineHeight: 1.45 }}>
                    <strong>Cursor 실행:</strong>{" "}
                    {item.applyLog.includes("[CURSOR_EXECUTION_FAILED]")
                      ? "실패 — applyLog·lastError·CURSOR_CLI_PATH 확인"
                      : item.applyLog.includes("[CURSOR_EXECUTION_DONE]")
                        ? "완료 — applyLog에 CLI/웹훅/스텁 요약·RAW 일부 포함"
                        : "진행/기록 — applyLog 펼쳐 확인"}
                  </p>
                ) : null}
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>retryCount:</strong> {item.retryCount ?? 0}{" "}
                  <span style={{ color: "#666", fontSize: 12 }}>
                    (최대 재시도 {MAX_GIT_APPLY_RETRIES}회, 남은 횟수:{" "}
                    {Math.max(0, MAX_GIT_APPLY_RETRIES - (item.retryCount ?? 0))})
                  </span>
                </p>
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>lastError:</strong> {item.lastError || "-"}
                </p>
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>lastRetryAt:</strong>{" "}
                  {item.lastRetryAt ? formatTestedAt(item.lastRetryAt) : "-"}
                </p>
                <p style={{ margin: 0, marginBottom: 4 }}>
                  <strong>applyLog:</strong> {item.applyLog ? "있음" : "없음"}
                </p>
                <div style={{ margin: "0 0 4px 0", fontSize: 13, lineHeight: 1.5 }}>
                  <strong>GitHub PR</strong>
                  <div style={{ marginTop: 4, color: "#333" }}>
                    <span style={{ color: "#555" }}>PR:</span>{" "}
                    {item.pullRequestNumber != null ? `#${item.pullRequestNumber}` : "—"}
                  </div>
                  <div style={{ color: "#333" }}>
                    <span style={{ color: "#555" }}>상태:</span>{" "}
                    {item.pullRequestState ?? "—"}
                  </div>
                  <div style={{ color: "#333" }}>
                    <span style={{ color: "#555" }}>리뷰:</span>{" "}
                    {item.reviewStatus ?? "—"}
                  </div>
                  <div style={{ color: "#333" }}>
                    <span style={{ color: "#555" }}>병합:</span> {formatPrMergeSummary(item)}
                  </div>
                  {prCreateFailLine ? (
                    <p style={{ margin: "8px 0 0 0", color: "#b00020", fontSize: 12 }}>
                      {prCreateFailLine}
                    </p>
                  ) : null}
                </div>
                <p style={{ margin: 0 }}>
                  <strong>createdAt:</strong> {formatTestedAt(item.createdAt)}
                </p>
                {isManualGitItem(item) && item.status === "REJECTED" ? (
                  <p style={{ margin: "8px 0 0 0", color: "#b00020", fontSize: 13 }}>
                    <strong>반려 사유:</strong> {item.rejectionReason?.trim() || "(없음)"}
                  </p>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {!isManualGitItem(item) &&
                    item.status === "REQUESTED" &&
                    item.applyStatus !== "FAILED" &&
                    item.applyStatus !== "DONE" &&
                    item.applyStatus !== "APPLYING" ? (
                      <button
                        type="button"
                        onClick={() => handleApplyGitRequest(item.id)}
                        disabled={applyingGitRequestId === item.id}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #ccc",
                          borderRadius: 6,
                          background: "#fff",
                          cursor: applyingGitRequestId === item.id ? "not-allowed" : "pointer",
                          opacity: applyingGitRequestId === item.id ? 0.7 : 1,
                        }}
                      >
                        {applyingGitRequestId === item.id ? "진행 중…" : "Git 반영 실행"}
                      </button>
                    ) : null}
                    {isManualGitItem(item) &&
                    item.status === "APPROVED" &&
                    item.applyStatus !== "FAILED" &&
                    item.applyStatus !== "DONE" &&
                    item.applyStatus !== "APPLYING" ? (
                      <button
                        type="button"
                        onClick={() => handleApplyGitRequest(item.id)}
                        disabled={applyingGitRequestId === item.id}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #ccc",
                          borderRadius: 6,
                          background: "#fff",
                          cursor: applyingGitRequestId === item.id ? "not-allowed" : "pointer",
                          opacity: applyingGitRequestId === item.id ? 0.7 : 1,
                        }}
                      >
                        {applyingGitRequestId === item.id ? "진행 중…" : "Git 반영 실행"}
                      </button>
                    ) : null}
                    {!isManualGitItem(item) &&
                    item.status === "REQUESTED" &&
                    item.applyStatus === "FAILED" ? (
                      <button
                        type="button"
                        onClick={() => handleRetryGitApply(item.id)}
                        disabled={
                          applyingGitRequestId === item.id ||
                          (item.retryCount ?? 0) >= MAX_GIT_APPLY_RETRIES
                        }
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #c62828",
                          borderRadius: 6,
                          background: "#fff",
                          cursor:
                            applyingGitRequestId === item.id ||
                            (item.retryCount ?? 0) >= MAX_GIT_APPLY_RETRIES
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            applyingGitRequestId === item.id ||
                            (item.retryCount ?? 0) >= MAX_GIT_APPLY_RETRIES
                              ? 0.5
                              : 1,
                        }}
                      >
                        {applyingGitRequestId === item.id
                          ? "재시도 중..."
                          : (item.retryCount ?? 0) >= MAX_GIT_APPLY_RETRIES
                            ? "재시도 한도 초과"
                            : "재시도 실행"}
                      </button>
                    ) : null}
                    {isManualGitItem(item) &&
                    item.status === "APPROVED" &&
                    item.applyStatus === "FAILED" ? (
                      <button
                        type="button"
                        onClick={() => handleRetryGitApply(item.id)}
                        disabled={
                          applyingGitRequestId === item.id ||
                          (item.retryCount ?? 0) >= MAX_GIT_APPLY_RETRIES
                        }
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #c62828",
                          borderRadius: 6,
                          background: "#fff",
                          cursor:
                            applyingGitRequestId === item.id ||
                            (item.retryCount ?? 0) >= MAX_GIT_APPLY_RETRIES
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            applyingGitRequestId === item.id ||
                            (item.retryCount ?? 0) >= MAX_GIT_APPLY_RETRIES
                              ? 0.5
                              : 1,
                        }}
                      >
                        {applyingGitRequestId === item.id
                          ? "재시도 중..."
                          : (item.retryCount ?? 0) >= MAX_GIT_APPLY_RETRIES
                            ? "재시도 한도 초과"
                            : "재시도 실행"}
                      </button>
                    ) : null}
                    {!executionSafeMode &&
                    uiPermissions.canRun &&
                    gitApplyMode === "git" &&
                    item.applyStatus === "DONE" &&
                    applyLogHasGitPushOk(item.applyLog) &&
                    item.pullRequestNumber == null ? (
                      <button
                        type="button"
                        onClick={() => handleGitHubPrAction(item.id, "create")}
                        disabled={gitPrBusyId === item.id}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #1565c0",
                          borderRadius: 6,
                          background: "#fff",
                          color: "#1565c0",
                          cursor: gitPrBusyId === item.id ? "not-allowed" : "pointer",
                          opacity: gitPrBusyId === item.id ? 0.7 : 1,
                        }}
                      >
                        {gitPrBusyId === item.id ? "처리 중..." : "GitHub PR 생성"}
                      </button>
                    ) : null}
                    {item.pullRequestUrl ? (
                      <a
                        href={item.pullRequestUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-block",
                          padding: "6px 10px",
                          border: "1px solid #1565c0",
                          borderRadius: 6,
                          background: "#1565c0",
                          color: "#fff",
                          textDecoration: "none",
                          fontSize: 13,
                          lineHeight: 1.2,
                        }}
                      >
                        PR 열기
                      </a>
                    ) : null}
                    {!executionSafeMode &&
                    uiPermissions.canRun &&
                    item.pullRequestNumber != null ? (
                      <button
                        type="button"
                        onClick={() => handleGitHubPrAction(item.id, "sync")}
                        disabled={gitPrBusyId === item.id}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #666",
                          borderRadius: 6,
                          background: "#fff",
                          cursor: gitPrBusyId === item.id ? "not-allowed" : "pointer",
                          opacity: gitPrBusyId === item.id ? 0.7 : 1,
                        }}
                      >
                        {gitPrBusyId === item.id ? "동기화 중..." : "PR 상태 동기화"}
                      </button>
                    ) : null}
                    {isManualGitItem(item) &&
                    item.status === "APPROVAL_REQUIRED" &&
                    uiPermissions.canApprove ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleGitApprove(item.id)}
                          disabled={applyingGitRequestId === item.id}
                          style={{
                            padding: "6px 10px",
                            border: "1px solid #0a7d2e",
                            borderRadius: 6,
                            background: "#0a7d2e",
                            color: "#fff",
                            cursor: applyingGitRequestId === item.id ? "not-allowed" : "pointer",
                            opacity: applyingGitRequestId === item.id ? 0.7 : 1,
                          }}
                        >
                          {applyingGitRequestId === item.id ? "처리 중..." : "승인"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGitReject(item.id)}
                          disabled={applyingGitRequestId === item.id}
                          style={{
                            padding: "6px 10px",
                            border: "1px solid #b00020",
                            borderRadius: 6,
                            background: "#fff",
                            color: "#b00020",
                            cursor: applyingGitRequestId === item.id ? "not-allowed" : "pointer",
                            opacity: applyingGitRequestId === item.id ? 0.7 : 1,
                          }}
                        >
                          {applyingGitRequestId === item.id ? "처리 중..." : "반려"}
                        </button>
                      </>
                    ) : null}
                    {isManualGitItem(item) &&
                    item.status === "REJECTED" &&
                    uiPermissions.canRun ? (
                      <button
                        type="button"
                        onClick={() => handleGitResubmitApproval(item.id)}
                        disabled={applyingGitRequestId === item.id}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #ccc",
                          borderRadius: 6,
                          background: "#fff",
                          cursor: applyingGitRequestId === item.id ? "not-allowed" : "pointer",
                          opacity: applyingGitRequestId === item.id ? 0.7 : 1,
                        }}
                      >
                        {applyingGitRequestId === item.id ? "처리 중..." : "승인 재요청"}
                      </button>
                    ) : null}
                  </div>
                  {isManualGitItem(item) &&
                  item.status === "APPROVAL_REQUIRED" &&
                  uiPermissions.canApprove ? (
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 420 }}>
                      <span style={{ fontSize: 12, color: "#666" }}>반려 사유 (선택)</span>
                      <textarea
                        value={gitRejectReasons[item.id] ?? ""}
                        onChange={(e) =>
                          setGitRejectReasons((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        rows={2}
                        style={{
                          fontSize: 13,
                          padding: 6,
                          borderRadius: 6,
                          border: "1px solid #ccc",
                        }}
                      />
                    </label>
                  ) : null}
                </div>
                {item.diffText ? (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>diffText 보기</summary>
                    <pre
                      style={{
                        marginTop: 8,
                        background: "#f7f7f7",
                        border: "1px solid #e0e0e0",
                        borderRadius: 8,
                        padding: 10,
                        whiteSpace: "pre-wrap",
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {item.diffText}
                    </pre>
                  </details>
                ) : null}
                {item.applyLog ? (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>applyLog 보기</summary>
                    <pre
                      style={{
                        marginTop: 8,
                        background: "#f7f7f7",
                        border: "1px solid #e0e0e0",
                        borderRadius: 8,
                        padding: 10,
                        whiteSpace: "pre-wrap",
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {item.applyLog}
                    </pre>
                  </details>
                ) : null}
                {item.latestExecutionJobId ? (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>Execution Timeline 보기</summary>
                    <ExecutionTimeline jobId={item.latestExecutionJobId} />
                  </details>
                ) : null}
              </div>
            );
            })}
          </div>
        )}
        </section>
      ) : null}
    </>
  );

  const showGuidedChrome = Boolean(!loading && project && !errorMessage);

  const detailTabs: { id: ProjectMainTab; label: string; uiLabel: string }[] = [
    { id: "overview", label: "생성 준비", uiLabel: "[P-3-2-1] Tab — Execution planning" },
    { id: "members", label: "멤버", uiLabel: "[P-3-2-2] Tab — Members (unified)" },
  ];

  return (
    <main
      data-ui-label="[P-1-1] Page Shell — Project Detail"
      style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}
    >
      <ProjectSpecPageHeader projectName={project?.name ?? null} />
      {executionSafeMode ? (
        <div
          role="status"
          data-ui-label="[P-1-2] Page Banner — Execution Safe Mode"
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ffcc80",
            background: "#fff8e1",
            color: "#e65100",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>안전 모드</strong>가 켜져 있습니다(서버 <code>JY_SAFE_MODE</code>). 실제 Git 워크스페이스 반영
          모드(git)는 비활성화되며, mock·cursor(스텁)만 사용할 수 있습니다.
        </div>
      ) : null}
      <ProjectSpecPageStatus loading={loading} errorMessage={errorMessage} />
      {showGuidedChrome && !loadingTasks && tasks.length === 0 ? (
        <div
          role="status"
          data-ui-label="[P-1-1a] Banner — No tasks yet"
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>작업이 아직 없습니다.</strong> 워크플로에 따라 생성 준비 화면에서 작업을 만든 뒤 프로토타입 생성·추적 단계로 진행하세요.
        </div>
      ) : null}
      {showGuidedChrome ? (
        <ProjectExecutionReadinessSummary
          setup={executionSetupOverview}
          loading={executionSetupOverviewLoading}
          settingsHref={projectExecutionSettingsHref(projectId, { from: "planning" })}
        />
      ) : null}
      {showGuidedChrome ? (
        <>
          <nav
            aria-label="프로젝트 섹션"
            data-ui-label="[P-3-1] Tab Chrome — Project Detail Regions"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: 8,
              marginBottom: 20,
              paddingBottom: 12,
              borderBottom: "1px solid #e5e5e5",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                flex: "1 1 auto",
              }}
            >
              {detailTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`project-detail-tab-${t.id}`}
                  data-ui-label={t.uiLabel}
                  onClick={() => setMainTab(t.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: mainTab === t.id ? "1px solid #2563eb" : "1px solid #ccc",
                    background: mainTab === t.id ? "#eff6ff" : "#fafafa",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: mainTab === t.id ? 600 : 500,
                    color: mainTab === t.id ? "#1e40af" : "#333",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <ProjectDetailGearMenu />
          </nav>

          {mainTab === "overview" ? (
            <div data-ui-label="[P-4-1] Overview Region — execution planning → tasks">
              <ProjectSpecWorkspace
                projectId={projectId}
                project={project}
                canEdit={rbac.canEditSpec}
                onProjectUpdated={setProject}
                onAfterTaskDraftsGenerate={refreshTasksAfterDraftGenerate}
                workflowExecution={{
                  hasPrimaryTasksForCurrentSpec: tasks.some(
                    (t) => String(t.taskKind ?? "").toUpperCase() === "PRIMARY"
                  ),
                  canRunExecution: uiPermissions.canRun,
                  execSetupReady: execSetupValidatedHint === true,
                  executionLoopBusy,
                  onStartExecution: () => void startExecutionFromPlanning(),
                }}
              />
              {projectFlowTail}
            </div>
          ) : null}

          {mainTab !== "overview" ? (
            <div data-ui-label="[P-4-4] Project Region — Members (unified)">
              {mainTab === "members" ? <ProjectMembersSummaryPanel projectId={projectId} members={memberRows} /> : null}
            </div>
          ) : null}
        </>
      ) : null}
      <ExecutionEnvironmentBlockedModal
        open={envBlockedModalOpen}
        onCancel={() => setEnvBlockedModalOpen(false)}
        onGoSettings={() => navigateToExecutionSettings()}
      />
    </main>
  );
}
