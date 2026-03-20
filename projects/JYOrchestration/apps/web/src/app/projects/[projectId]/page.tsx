"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ProjectInfoCard } from "@/components/project-spec/ProjectInfoCard";
import { ProjectSpecGuideSection } from "@/components/project-spec/ProjectSpecGuideSection";
import { ProjectSpecPromptSection } from "@/components/project-spec/ProjectSpecPromptSection";
import { ProjectSpecUploadHistorySection } from "@/components/project-spec/ProjectSpecUploadHistorySection";
import { ProjectSpecUploadTestSection } from "@/components/project-spec/ProjectSpecUploadTestSection";
import {
  ApiResponse,
  Project,
  UploadHistoryItem,
  UploadResult,
  UploadStatus,
} from "@/components/project-spec/types";

function formatTestedAt(date: Date) {
  return date.toLocaleString("ko-KR", { hour12: false });
}

const fallbackProject: Project = {
  id: "",
  name: "프로젝트 정보 로딩 중",
  description: null,
  projectType: "-",
  status: "-",
};

function buildProjectSpecPrompt(project: Project) {
  return `너는 소프트웨어 아키텍트이자 요구사항 분석가다.
아래 프로젝트 정보를 기반으로 ProjectSpec 문서를 "마크다운 문서"로 작성하라.
불필요하게 장황한 설명은 제외하고, 구조화된 결과만 제공하라.

[프로젝트 정보]
- 프로젝트명: ${project.name}
- 설명: ${project.description || "설명 없음"}
- 유형: ${project.projectType}
- 상태: ${project.status}

[출력 규칙]
- 반드시 마크다운 헤더/목록 구조로 작성
- 각 섹션은 실행 가능한 수준으로 구체적으로 작성
- 범위, 우선순위, 수용 기준은 누락 없이 작성

[필수 섹션]
1. 프로젝트 개요
2. 목표 및 범위 (In scope / Out of scope)
3. 사용자 및 핵심 유스케이스
4. 기능 요구사항 (우선순위 포함)
5. 비기능 요구사항 (성능, 보안, 운영)
6. 제약사항 및 가정
7. 성공 지표 및 수용 기준
8. 초기 마일스톤`;
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

  useEffect(() => {
    if (!projectId) return;

    async function loadProjectDetail() {
      try {
        setLoading(true);
        setErrorMessage(null);

        const res = await fetch("/api/projects");
        const json = (await res.json()) as ApiResponse<Project[]>;

        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          setProject(null);
          setErrorMessage(json.message || "프로젝트 정보를 불러오지 못했습니다.");
          return;
        }

        const target = json.data.find((item) => item.id === projectId) || null;
        if (!target) {
          setProject(null);
          setErrorMessage("존재하지 않는 프로젝트입니다.");
          return;
        }

        setProject(target);
      } catch (error) {
        console.error("Failed to load project detail:", error);
        setProject(null);
        setErrorMessage("프로젝트 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    loadProjectDetail();
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
    setUploadMessage("현재 단계에서는 업로드 API 뼈대를 검증합니다.");
    setUploadResult(null);
    setUploadStatus("idle");
  }

  async function handleUploadTest() {
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

      const res = await fetch("/api/project-spec/upload", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as ApiResponse<UploadResult>;
      if (!res.ok || !json.success || !json.data) {
        setUploadMessage(json.message || "업로드 테스트 요청에 실패했습니다.");
        setUploadStatus("error");
        return;
      }

      setUploadResult(json.data);
      setUploadMessage(json.message || "업로드 API 뼈대가 정상 동작했습니다.");
      setUploadStatus("success");
      setUploadHistory((prev) => [
        {
          fileName: json.data.fileName,
          fileSize: json.data.fileSize,
          fileType: json.data.fileType || "unknown",
          testedAt: formatTestedAt(new Date()),
        },
        ...prev,
      ]);
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
      <div style={{ marginBottom: 20 }}>
        <Link href="/" style={{ color: "#333", textDecoration: "none" }}>
          ← 프로젝트 목록으로
        </Link>
      </div>

      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 20 }}>
        ProjectSpec 설정
      </h1>

      {loading ? (
        <p style={{ marginBottom: 16 }}>프로젝트 정보를 불러오는 중...</p>
      ) : null}
      {errorMessage ? (
        <p style={{ marginBottom: 16, color: "#b00020" }}>{errorMessage}</p>
      ) : null}

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
