"use client";

import { useParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
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
import { TaskListSection } from "@/components/task/TaskListSection";

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
        const { res, json } = await fetchGeneratedTasks(projectId);
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          return;
        }
        setTasks(json.data);
      } catch (error) {
        console.error("Failed to load generated tasks:", error);
      }
    }

    loadProjectDetail();
    loadUploadHistory();
    loadTasks();
  }, [projectId]);

  const projectSpecPrompt = useMemo(
    () => buildProjectSpecPrompt(project ?? fallbackProject),
    [project]
  );

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
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setTaskMessage(json.message || "Task 생성 요청에 실패했습니다.");
        return;
      }

      setTaskMessage(json.message || "Task 생성이 완료되었습니다.");
      const taskResult = await fetchGeneratedTasks(projectId);
      if (taskResult.res.ok && taskResult.json.success && Array.isArray(taskResult.json.data)) {
        setTasks(taskResult.json.data);
      }
    } catch (error) {
      console.error("Failed to generate tasks from parsed spec:", error);
      setTaskMessage("Task 생성 중 오류가 발생했습니다.");
    } finally {
      setGeneratingTaskUploadId(null);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <ProjectSpecPageHeader />
      <ProjectSpecPageStatus loading={loading} errorMessage={errorMessage} />
      <ProjectInfoCard project={project} />
      <ProjectSpecGuideSection />
      <ProjectSpecPromptSection prompt={projectSpecPrompt} />
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
      <ProjectSpecUploadHistorySection
        uploadHistory={uploadHistory}
        parsingUploadId={parsingUploadId}
        generatingTaskUploadId={generatingTaskUploadId}
        parseMessage={parseMessage}
        taskMessage={taskMessage}
        onParse={handleRunParse}
        onGenerateTasks={handleGenerateTasks}
      />
      <TaskListSection tasks={tasks} />
    </main>
  );
}
