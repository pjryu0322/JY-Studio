"use client";

import { useParams } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RolePermissions } from "@/lib/auth/roles";
import {
  fetchGeneratedTasks,
  fetchProjectById,
  fetchProjectSpecUploadHistory,
  generateTasksFromParsedSpec,
  runProjectSpecMockParse,
  uploadProjectSpecTestFile,
} from "@/components/project-spec/api";
import { ProjectInfoCard } from "@/components/project-spec/ProjectInfoCard";
import { ProjectSpecGuideSection } from "@/components/project-spec/ProjectSpecGuideSection";
import { ProjectSpecPageHeader } from "@/components/project-spec/ProjectSpecPageHeader";
import { ProjectSpecPageStatus } from "@/components/project-spec/ProjectSpecPageStatus";
import { ProjectSpecPromptSection } from "@/components/project-spec/ProjectSpecPromptSection";
import { ProjectSpecUploadHistorySection } from "@/components/project-spec/ProjectSpecUploadHistorySection";
import { ProjectSpecUploadTestSection } from "@/components/project-spec/ProjectSpecUploadTestSection";
import { buildProjectSpecPrompt, fallbackProject } from "@/components/project-spec/prompt";
import { Project, TaskItem, UploadHistoryItem, UploadResult, UploadStatus } from "@/components/project-spec/types";
import {
  GitChangeRequestItem,
  TaskFollowUpDraft,
  TaskListSection,
  TaskPromptItem,
  TaskRunItem,
} from "@/components/task/TaskListSection";
import { TaskHistoryItem, TaskHistoryTimeline } from "@/components/task/TaskHistoryTimeline";
import { formatTestedAt } from "@/components/project-spec/format";
import { ProjectMembersSection, type ProjectMemberUiRow } from "@/components/project-spec/ProjectMembersSection";
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
import {
  IdeaGuidedUx,
  type IdeaUxFailureAssist,
} from "@/components/onboarding/IdeaGuidedUx";
import { CollapsibleSection } from "@/components/common/CollapsibleSection";
import {
  computeIdeaGuidedUxSnapshot,
  type IdeaUxPrimaryAction,
} from "@/lib/onboarding/ideaGuidedUx";
import { computeProjectGuidedFlowSnapshot } from "@/lib/onboarding/projectGuidedFlow";
import { ProjectGuidedFlowPanel } from "@/components/onboarding/ProjectGuidedFlowPanel";
import { ExecutionTimeline } from "@/components/git/ExecutionTimeline";

function rbacForbiddenMessage(
  res: Response,
  json: { code?: string; message?: string }
): string | null {
  if (res.status === 403 && json.code === RBAC_FORBIDDEN_CODE && json.message) {
    return json.message;
  }
  return null;
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = typeof params?.projectId === "string" ? params.projectId : "";
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [parseMessage, setParseMessage] = useState<string | null>(null);
  const [parsingUploadId, setParsingUploadId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [generatingTaskUploadId, setGeneratingTaskUploadId] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskPrompts, setTaskPrompts] = useState<TaskPromptItem[]>([]);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);
  const [generatingPromptTaskId, setGeneratingPromptTaskId] = useState<string | null>(null);
  const [taskRuns, setTaskRuns] = useState<TaskRunItem[]>([]);
  const [runningPromptId, setRunningPromptId] = useState<string | null>(null);
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
  const [executionSafeMode, setExecutionSafeMode] = useState(false);
  const [ideaUxRecommended, setIdeaUxRecommended] = useState(true);
  const [progressPanelOpen, setProgressPanelOpen] = useState(false);
  const [advancedPanelOpen, setAdvancedPanelOpen] = useState(false);

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
  const rbac = useMemo(
    () => ({
      canEditSpec: canEditSpec(projectRole),
      canReview: canReview(projectRole),
      canOperate: canOperate(projectRole),
      canManageMembers: canManageMembers(projectRole),
    }),
    [projectRole]
  );
  const showSpecUploadHistory = rbac.canEditSpec || rbac.canReview;
  const showTaskSection = rbac.canReview || rbac.canOperate || rbac.canEditSpec;

  useEffect(() => {
    if (!ideaUxRecommended) {
      setProgressPanelOpen(true);
      setAdvancedPanelOpen(true);
    }
  }, [ideaUxRecommended]);

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

    async function loadUploadHistory() {
      try {
        const { res, json } = await fetchProjectSpecUploadHistory(projectId);
        const denied = rbacForbiddenMessage(res, json);
        if (denied) {
          setErrorMessage(denied);
          return;
        }
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          return;
        }
        setUploadHistory(json.data);
      } catch (error) {
        console.error("Failed to load upload metadata history:", error);
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
    loadUploadHistory();
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

  const projectSpecPrompt = useMemo(
    () => buildProjectSpecPrompt(project ?? fallbackProject),
    [project]
  );

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

  const guidedFlowSnapshot = useMemo(
    () =>
      computeProjectGuidedFlowSnapshot({
        uploadHistory,
        tasks,
        taskPrompts,
        taskRuns,
        gitRequests,
      }),
    [uploadHistory, tasks, taskPrompts, taskRuns, gitRequests]
  );

  const ideaUxSnapshot = useMemo(
    () =>
      computeIdeaGuidedUxSnapshot({
        uploadHistory,
        tasks,
        taskRuns,
        gitRequests,
        taskPromptMap,
        taskRunMap,
        canRegisterSpec: rbac.canEditSpec,
        canReview: rbac.canReview,
        canOperate: uiPermissions.canRun,
      }),
    [
      uploadHistory,
      tasks,
      taskRuns,
      gitRequests,
      taskPromptMap,
      taskRunMap,
      rbac.canEditSpec,
      rbac.canReview,
      uiPermissions.canRun,
    ]
  );

  const ideaUxFailureLines = useMemo(() => {
    const lines: string[] = [];
    if (gitApplyError) {
      lines.push(gitApplyError);
    }
    if (uploadStatus === "error" && uploadMessage) {
      lines.push(uploadMessage);
    }
    if (parseMessage && /실패|오류|denied|403|FAIL|실패했습니다/i.test(parseMessage)) {
      lines.push(parseMessage);
    }
    if (taskMessage && /실패|오류|FAIL|실패했습니다/i.test(taskMessage)) {
      lines.push(taskMessage);
    }
    if (promptMessage && /실패|오류|FAIL|실패했습니다/i.test(promptMessage)) {
      lines.push(promptMessage);
    }
    return lines;
  }, [gitApplyError, uploadStatus, uploadMessage, parseMessage, taskMessage, promptMessage]);

  const ideaUxFailureAssist = useMemo((): IdeaUxFailureAssist | null => {
    const failedRuns = taskRuns.filter((r) => r.status === "FAILED");
    const latestFailed =
      failedRuns.length === 0
        ? null
        : [...failedRuns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (latestFailed) {
      const t = tasks.find((x) => x.id === latestFailed.taskId);
      const shortCause = t
        ? `「${t.name}」을(를) 끝내지 못했습니다.`
        : "자동 실행이 끝나지 않았습니다.";
      const detailLines = [
        ...ideaUxFailureLines,
        ...(latestFailed.resultText?.trim()
          ? [
              `시스템 메시지(일부): ${latestFailed.resultText.slice(0, 240)}${latestFailed.resultText.length > 240 ? "…" : ""}`,
            ]
          : []),
      ].filter(Boolean);
      return {
        kind: "run_failed",
        headline: "실행이 끝나지 않았습니다",
        shortCause,
        detailLines,
        taskId: latestFailed.taskId,
      };
    }
    const failedGit = gitRequests.find((g) => g.applyStatus === "FAILED");
    if (failedGit) {
      const lines = [...ideaUxFailureLines];
      if (gitApplyError) {
        lines.push(gitApplyError);
      }
      return {
        kind: "git_failed",
        headline: "저장소에 반영하지 못했습니다",
        shortCause: "아래에서 다시 시도하거나, 자세히 보기로 원인을 확인하세요.",
        detailLines: lines,
        gitChangeRequestId: failedGit.id,
      };
    }
    if (ideaUxFailureLines.length > 0) {
      return {
        kind: "generic",
        headline: "잠깐 확인이 필요합니다",
        shortCause: ideaUxFailureLines[0].slice(0, 160),
        detailLines: ideaUxFailureLines,
      };
    }
    return null;
  }, [taskRuns, tasks, gitRequests, ideaUxFailureLines, gitApplyError]);

  const ideaUxActionBusy =
    parsingUploadId !== null ||
    generatingTaskUploadId !== null ||
    applyingGitRequestId !== null ||
    registeringGitRequestRunId !== null ||
    runningPromptId !== null ||
    generatingPromptTaskId !== null ||
    markingReadyTaskId !== null ||
    gitPrBusyId !== null;

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

  function handleSelectFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setSelectedFileName(null);
      setUploadMessage(null);
      setUploadResult(null);
      setUploadStatus("idle");
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
    setUploadMessage("md는 원문 저장을 시도하고, doc/docx는 메타데이터 중심으로 등록합니다.");
    setUploadResult(null);
    setUploadStatus("idle");
  }

  async function handleUploadTest() {
    if (!projectId) {
      setUploadMessage("projectId 정보를 확인할 수 없습니다.");
      setUploadResult(null);
      setUploadStatus("error");
      return;
    }

    if (!selectedFile) {
      setUploadMessage("업로드할 파일을 먼저 선택해 주세요.");
      setUploadResult(null);
      setUploadStatus("error");
      return;
    }

    try {
      setUploading(true);
      setUploadMessage(null);
      setUploadResult(null);
      setUploadStatus("idle");
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("projectId", projectId);

      const { res, json } = await uploadProjectSpecTestFile(formData, projectId);
      if (!res.ok || !json.success || !json.data) {
        setUploadMessage(json.message || "업로드 테스트 요청에 실패했습니다.");
        setUploadStatus("error");
        return;
      }

      setUploadResult(json.data);
      setUploadMessage(json.message || "ProjectSpec 업로드 메타데이터가 등록되었습니다.");
      setUploadStatus("success");
      setParseMessage(null);
      setTaskMessage(null);
      const historyResult = await fetchProjectSpecUploadHistory(projectId);
      if (
        historyResult.res.ok &&
        historyResult.json.success &&
        Array.isArray(historyResult.json.data)
      ) {
        setUploadHistory(historyResult.json.data);
      }
    } catch (error) {
      console.error("Failed to upload project spec file:", error);
      setUploadMessage("업로드 테스트 중 오류가 발생했습니다.");
      setUploadResult(null);
      setUploadStatus("error");
    } finally {
      setUploading(false);
    }
  }

  async function handleRunParse(uploadId: string) {
    if (!projectId) {
      setParseMessage("projectId 정보를 확인할 수 없습니다.");
      return;
    }

    try {
      setParsingUploadId(uploadId);
      setParseMessage(null);

      const { res, json } = await runProjectSpecMockParse(uploadId);
      setParseMessage(
        json.message ||
          (res.ok ? "ProjectSpec mock parsing이 완료되었습니다." : "ProjectSpec parsing에 실패했습니다.")
      );

      const historyResult = await fetchProjectSpecUploadHistory(projectId);
      if (
        historyResult.res.ok &&
        historyResult.json.success &&
        Array.isArray(historyResult.json.data)
      ) {
        setUploadHistory(historyResult.json.data);
      }
    } catch (error) {
      console.error("Failed to run project spec mock parse:", error);
      setParseMessage("mock parsing 실행 중 오류가 발생했습니다.");
    } finally {
      setParsingUploadId(null);
    }
  }

  async function handleGenerateTasks(uploadId: string) {
    if (!projectId) {
      setTaskMessage("projectId 정보를 확인할 수 없습니다.");
      return;
    }

    try {
      setGeneratingTaskUploadId(uploadId);
      setTaskMessage(null);

      const { res, json } = await generateTasksFromParsedSpec(uploadId);
      if (!res.ok || !json.success || !json.data || !Array.isArray(json.data.items)) {
        setTaskMessage(json.message || "Task 생성 요청에 실패했습니다.");
        return;
      }

      setTaskMessage(json.message || "Task 생성이 완료되었습니다.");
      setPromptMessage(null);
      const taskResult = await fetchGeneratedTasks(projectId);
      if (taskResult.res.ok && taskResult.json.success && Array.isArray(taskResult.json.data)) {
        setTasks(taskResult.json.data);
      } else {
        setTasks(json.data.items);
      }
    } catch (error) {
      console.error("Failed to generate tasks from parsed spec:", error);
      setTaskMessage("Task 생성 중 오류가 발생했습니다.");
    } finally {
      setGeneratingTaskUploadId(null);
    }
  }

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
    const prompt = taskPromptMap[taskId];
    if (!prompt) {
      setPromptMessage("먼저 프롬프트를 생성해 주세요.");
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

  function handleIdeaPrimaryAction(action: IdeaUxPrimaryAction) {
    const scroll = (id: string) => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    switch (action.id) {
      case "scroll_upload":
        scroll("guided-flow-upload");
        return;
      case "scroll_history":
        scroll("guided-flow-history");
        return;
      case "scroll_tasks":
        scroll("guided-flow-tasks");
        return;
      case "scroll_git":
        scroll("guided-flow-git");
        return;
      case "run_parse":
        if (action.uploadId) {
          void handleRunParse(action.uploadId);
        }
        return;
      case "generate_tasks":
        if (action.uploadId) {
          void handleGenerateTasks(action.uploadId);
        }
        return;
      case "generate_prompt":
        if (action.taskId) {
          void handleGenerateTaskPrompt(action.taskId);
        }
        return;
      case "run_task":
        if (action.taskId) {
          void handleRunTask(action.taskId);
        }
        return;
      case "mark_ready_for_git":
        if (action.taskId) {
          void handleMarkReadyForGit(action.taskId);
        }
        return;
      case "register_git_request":
        if (action.taskId) {
          void handleRegisterGitRequest(action.taskId);
        }
        return;
      case "apply_git":
        if (action.gitChangeRequestId) {
          void handleApplyGitRequest(action.gitChangeRequestId);
        }
        return;
      case "retry_git_apply":
        if (action.gitChangeRequestId) {
          void handleRetryGitApply(action.gitChangeRequestId);
        }
        return;
      case "create_pr":
        if (action.gitChangeRequestId) {
          void handleGitHubPrAction(action.gitChangeRequestId, "create");
        }
        return;
      case "sync_pr":
        if (action.gitChangeRequestId) {
          void handleGitHubPrAction(action.gitChangeRequestId, "sync");
        }
        return;
      case "retry_run":
        if (action.taskId) {
          void handleRunTask(action.taskId);
        }
        return;
      case "follow_up":
        if (action.taskId) {
          setAdvancedPanelOpen(true);
          handleRequestFollowUp(action.taskId);
          requestAnimationFrame(() => {
            document.getElementById("guided-flow-tasks")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          });
        }
        return;
      case "none":
      default:
        return;
    }
  }

  const handleIdeaUxBeforeAnchor = useCallback(
    (anchorId: string) => {
      if (!ideaUxRecommended) {
        return;
      }
      setAdvancedPanelOpen(true);
      if (anchorId === "guided-flow-git") {
        setProgressPanelOpen(true);
      }
    },
    [ideaUxRecommended]
  );

  const projectFlowTail = (
    <>
      <div id="guided-flow-upload">
        {rbac.canEditSpec ? (
          <ProjectSpecUploadTestSection
            selectedFile={selectedFile}
            selectedFileName={selectedFileName}
            uploadMessage={uploadMessage}
            uploadResult={uploadResult}
            uploadStatus={uploadStatus}
            uploading={uploading}
            onSelectFile={handleSelectFile}
            onUploadTest={handleUploadTest}
          />
        ) : null}
      </div>
      {showSpecUploadHistory ? (
        <div id="guided-flow-history">
          {!rbac.canEditSpec && rbac.canReview ? (
            <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "#555", lineHeight: 1.5 }}>
              ProjectSpec 파일 등록·업로드는 PLANNER 또는 OWNER 역할에서 수행합니다. 아래는 등록된 업로드
              이력과 파싱·Task 단계입니다.
            </p>
          ) : null}
          <ProjectSpecUploadHistorySection
            uploadHistory={uploadHistory}
            parsingUploadId={parsingUploadId}
            generatingTaskUploadId={generatingTaskUploadId}
            parseMessage={parseMessage}
            taskMessage={taskMessage}
            canRunReviewActions={rbac.canReview}
            onParse={handleRunParse}
            onGenerateTasks={handleGenerateTasks}
          />
        </div>
      ) : null}
      {showTaskSection ? (
        <div id="guided-flow-tasks">
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
        />
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
                        {applyingGitRequestId === item.id ? "실행 중..." : "Git 반영 실행"}
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
                        {applyingGitRequestId === item.id ? "실행 중..." : "Git 반영 실행"}
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

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <ProjectSpecPageHeader />
      {executionSafeMode ? (
        <div
          role="status"
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
      {showGuidedChrome ? (
        <IdeaGuidedUx
          snapshot={ideaUxSnapshot}
          recommendedMode={ideaUxRecommended}
          onRecommendedModeChange={setIdeaUxRecommended}
          failureAssist={ideaUxFailureAssist}
          actionBusy={ideaUxActionBusy}
          onPrimaryAction={handleIdeaPrimaryAction}
          onBeforeNavigateToAnchor={handleIdeaUxBeforeAnchor}
        />
      ) : null}
      {showGuidedChrome && ideaUxRecommended ? (
        <>
          <CollapsibleSection
            title="진행 현황 보기"
            subtitle="이 프로젝트가 어디까지 왔는지 한눈에"
            defaultOpen={false}
            open={progressPanelOpen}
            onOpenChange={setProgressPanelOpen}
          >
            <ProjectInfoCard
              project={project}
              currentUserRoleLabel={projectRole && projectId ? projectRole : null}
            />
            {uiPermissions.canRun ? (
              <ExecutionObservabilityPanel
                data={execSummary}
                loading={execSummaryLoading}
                errorMessage={execSummaryError}
              />
            ) : null}
          </CollapsibleSection>
          <CollapsibleSection
            title="전체 기능 펼치기"
            subtitle="문서 업로드, 실행, 저장소 반영, 기록 보기 등"
            defaultOpen={false}
            open={advancedPanelOpen}
            onOpenChange={setAdvancedPanelOpen}
          >
            {!loading && project ? (
              <ProjectGuidedFlowPanel
                snapshot={guidedFlowSnapshot}
                canRegisterSpec={rbac.canEditSpec}
                canReview={rbac.canReview}
                canOperate={uiPermissions.canRun}
              />
            ) : null}
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
              프로젝트 생성자는 OWNER이며, OWNER / EDITOR / REVIEWER / VIEWER 역할과 HUMAN / AI 멤버를
              함께 관리할 수 있습니다.
            </p>
            <ProjectMembersSection
              projectId={projectId}
              members={memberRows}
              canManageMembers={rbac.canManageMembers}
              onChanged={reloadSessionContext}
            />
            {rbac.canEditSpec ? <ProjectSpecGuideSection /> : null}
            {rbac.canEditSpec ? (
              <ProjectSpecPromptSection prompt={projectSpecPrompt} />
            ) : null}
            {projectFlowTail}
          </CollapsibleSection>
        </>
      ) : (
        <>
          <ProjectInfoCard
            project={project}
            currentUserRoleLabel={projectRole && projectId ? projectRole : null}
          />
          {!loading && project ? (
            <ProjectGuidedFlowPanel
              snapshot={guidedFlowSnapshot}
              canRegisterSpec={rbac.canEditSpec}
              canReview={rbac.canReview}
              canOperate={uiPermissions.canRun}
            />
          ) : null}
          {uiPermissions.canRun ? (
            <ExecutionObservabilityPanel
              data={execSummary}
              loading={execSummaryLoading}
              errorMessage={execSummaryError}
            />
          ) : null}
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
            프로젝트 생성자는 OWNER이며, OWNER / EDITOR / REVIEWER / VIEWER 역할과 HUMAN / AI 멤버를 함께
            관리할 수 있습니다.
          </p>
          <ProjectMembersSection
            projectId={projectId}
            members={memberRows}
            canManageMembers={rbac.canManageMembers}
            onChanged={reloadSessionContext}
          />
          {rbac.canEditSpec ? <ProjectSpecGuideSection /> : null}
          {rbac.canEditSpec ? (
            <ProjectSpecPromptSection prompt={projectSpecPrompt} />
          ) : null}
          {projectFlowTail}
        </>
      )}
    </main>
  );
}
