"use client";

import { useParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  fetchProjectById,
  fetchProjectSpecUploadHistory,
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
import { Project, UploadHistoryItem, UploadResult, UploadStatus } from "@/components/project-spec/types";

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

    loadProjectDetail();
    loadUploadHistory();
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
      const { res, json } = await uploadProjectSpecTestFile(selectedFile, projectId);
      if (!res.ok || !json.success || !json.data) {
        setUploadMessage(json.message || "업로드 테스트 요청에 실패했습니다.");
        setUploadStatus("error");
        return;
      }

      setUploadResult(json.data);
      setUploadMessage(json.message || "ProjectSpec 업로드 메타데이터가 등록되었습니다.");
      setUploadStatus("success");
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
      <ProjectSpecUploadHistorySection uploadHistory={uploadHistory} />
    </main>
  );
}
