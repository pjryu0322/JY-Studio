"use client";

import { useParams } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  TaskListSection,
  TaskPromptItem,
  TaskRunItem,
} from "@/components/task/TaskListSection";
import { TaskHistoryItem, TaskHistoryTimeline } from "@/components/task/TaskHistoryTimeline";
import { formatTestedAt } from "@/components/project-spec/format";
import { ProjectMembersSection } from "@/components/project-spec/ProjectMembersSection";
import {
  getCurrentMockUser,
  getCurrentUserProjectRole,
  getProjectMembersMock,
} from "@/lib/rbac/mockProjectContext";
import {
  canEditSpec,
  canManageMembers,
  canOperate,
  canReview,
} from "@/lib/rbac/projectPermissions";
import { mockAuthHeaders } from "@/lib/auth/requestUser";
import { RBAC_FORBIDDEN_CODE } from "@/lib/rbac/projectAccessDenied";

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
  const [auditTaskId, setAuditTaskId] = useState<string | null>(null);
  const [auditHistory, setAuditHistory] = useState<TaskHistoryItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [abortingTaskId, setAbortingTaskId] = useState<string | null>(null);
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null);
  const [unblockingTaskId, setUnblockingTaskId] = useState<string | null>(null);
  const [forceCompletingTaskId, setForceCompletingTaskId] = useState<string | null>(null);

  const currentUser = useMemo(() => getCurrentMockUser(), []);
  const projectRole = useMemo(
    () => (projectId ? getCurrentUserProjectRole(projectId, currentUser.id) : null),
    [projectId, currentUser.id]
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
  const memberRows = useMemo(
    () => (projectId ? getProjectMembersMock(projectId) : []),
    [projectId]
  );
  const showSpecUploadHistory = rbac.canEditSpec || rbac.canReview;
  const showTaskSection = rbac.canReview || rbac.canOperate || rbac.canEditSpec;

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
          headers: mockAuthHeaders(),
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
          headers: mockAuthHeaders(),
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
          headers: mockAuthHeaders(),
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
          { headers: mockAuthHeaders() }
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

  const reloadTaskRuns = useCallback(async () => {
    if (!projectId) {
      return;
    }
    try {
      const encodedProjectId = encodeURIComponent(projectId);
      const runRes = await fetch(`/api/task/run?projectId=${encodedProjectId}`, {
        headers: mockAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
        headers: mockAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
        setPromptMessage(json.message || "Task 실행 요청에 실패했습니다.");
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
        },
        body: JSON.stringify({ taskRunId: run.id }),
      });

      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        code?: string;
      };

      if (!res.ok || !json.success) {
        setPromptMessage(json.message || "Git 반영 요청 등록에 실패했습니다.");
        return;
      }

      const encodedProjectId = encodeURIComponent(projectId);
      const listRes = await fetch(`/api/task/git-apply?projectId=${encodedProjectId}`, {
        headers: mockAuthHeaders(),
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
      headers: mockAuthHeaders(),
    });
    const listJson = (await listRes.json()) as {
      success: boolean;
      data?: GitChangeRequestItem[];
    };
    if (listRes.ok && listJson.success && Array.isArray(listJson.data)) {
      setGitRequests(listJson.data);
    }
  }

  async function handleApplyGitRequest(gitChangeRequestId: string) {
    try {
      setApplyingGitRequestId(gitChangeRequestId);
      setGitApplyMessage(null);
      setGitApplyError(null);

      const res = await fetch("/api/task/git-apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
      setGitApplyError(null);
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
        headers: {
          "Content-Type": "application/json",
          ...mockAuthHeaders(),
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
      setGitApplyError(null);
    } catch (error) {
      console.error("Failed to retry git change request:", error);
      setGitApplyError("Git 반영 재시도 중 오류가 발생했습니다.");
      setGitApplyMessage(null);
    } finally {
      setApplyingGitRequestId(null);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <ProjectSpecPageHeader />
      <ProjectSpecPageStatus loading={loading} errorMessage={errorMessage} />
      <ProjectInfoCard
        project={project}
        currentUserRoleLabel={projectRole && projectId ? projectRole : null}
      />
      <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
        프로젝트 생성 시 생성자는 OWNER로 기록되며, 이후 PLANNER / REVIEWER / OPERATOR로 역할을 나눌 수
        있습니다. 현재 사용자·멤버 목록은 mock 기준입니다.
      </p>
      {rbac.canManageMembers ? <ProjectMembersSection members={memberRows} /> : null}
      {rbac.canEditSpec ? <ProjectSpecGuideSection /> : null}
      {rbac.canEditSpec ? <ProjectSpecPromptSection prompt={projectSpecPrompt} /> : null}
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
      {showSpecUploadHistory ? (
        <>
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
        </>
      ) : null}
      {showTaskSection ? (
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
          canRunTask={rbac.canOperate}
          canMarkReadyForGit={rbac.canOperate}
          canRegisterGitRequest={rbac.canOperate}
          canReorderTasks={rbac.canOperate}
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
        />
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
      {rbac.canOperate ? (
        <section
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
              <option value="cursor">Cursor 실행 (스텁)</option>
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
              원격 push 요청 (GIT_APPLY_PUSH_ENABLED=true 일 때만 실제 push)
            </label>
          ) : null}
          {gitApplyMode === "cursor" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#555" }}>
              <input
                type="checkbox"
                checked={gitApplySimulateFailure}
                onChange={(e) => setGitApplySimulateFailure(e.target.checked)}
              />
              Cursor 스텁 실패 시뮬레이션 (simulateFailure)
            </label>
          ) : null}
        </div>
        <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
          <strong>모드 안내:</strong> Mock은 내부 시뮬레이션만 수행합니다. Cursor는 Cursor 연동 구조·페이로드
          검증(스텁) 단계입니다. Git은 로컬 저장소 반영 구조 검증 단계이며, 실제 원격 push는 기본 비활성입니다.
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
            {gitRequests.map((item) => (
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
                <p style={{ margin: 0 }}>
                  <strong>createdAt:</strong> {formatTestedAt(item.createdAt)}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {item.status === "REQUESTED" &&
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
                  {item.status === "REQUESTED" && item.applyStatus === "FAILED" ? (
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
              </div>
            ))}
          </div>
        )}
        </section>
      ) : null}
    </main>
  );
}
