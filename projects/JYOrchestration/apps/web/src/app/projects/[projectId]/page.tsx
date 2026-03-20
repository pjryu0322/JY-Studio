"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  projectType: string;
  status: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

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
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

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
      setSelectedFileName(null);
      setUploadMessage(null);
      return;
    }

    setSelectedFileName(file.name);
    setUploadMessage("현재 단계에서는 업로드 UI만 제공됩니다.");
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

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>프로젝트 기본 정보</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <strong>프로젝트명:</strong> {project?.name || "정보 없음"}
          </div>
          <div>
            <strong>설명:</strong> {project?.description || "설명 없음"}
          </div>
          <div>
            <strong>Project Type:</strong> {project?.projectType || "-"}
          </div>
          <div>
            <strong>Status:</strong> {project?.status || "-"}
          </div>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>ProjectSpec 등록 안내</h2>
        <p style={{ marginBottom: 8 }}>
          ProjectSpec은 프로젝트의 목표, 범위, 요구사항을 한 문서로 정리하는 기준 문서입니다. 이
          문서가 명확해야 이후 단계에서 FeatureSpec과 Task를 일관된 기준으로 생성할 수 있습니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          ProjectSpec이 부정확하면 기능 우선순위가 흔들리고 구현 범위가 커지며, 이후 일정/품질/검증
          단계에서 재작업이 반복될 수 있습니다. 초기 문서 품질이 전체 개발 효율을 좌우합니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          아래 필수 항목을 기준으로 ProjectSpec을 작성하면 다음 단계의 Feature 분해와 Task 계획이
          훨씬 안정적으로 진행됩니다.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>프로젝트 개요</li>
          <li>목표 / 범위</li>
          <li>핵심 사용자 및 유스케이스</li>
          <li>기능 요구사항</li>
          <li>비기능 요구사항</li>
          <li>제약사항 / 가정</li>
          <li>성공 기준 / 수용 기준</li>
          <li>초기 마일스톤</li>
        </ul>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>GPT 프롬프트 가이드</h2>
        <p style={{ marginBottom: 10 }}>
          아래 프롬프트를 복사해서 GPT에 붙여넣으면, ProjectSpec 초안을 마크다운 구조로 빠르게 만들
          수 있습니다.
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f7f7f7",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            padding: 14,
            fontSize: 14,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {projectSpecPrompt}
        </pre>
      </section>

      <section
        style={{
          border: "1px dashed #bbb",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>ProjectSpec 업로드 (다음 단계)</h2>
        <p style={{ marginTop: 0, marginBottom: 10 }}>
          ProjectSpec은 Markdown/DOCX 중심으로 다룰 예정이며, 다음 단계에서 업로드 API와 파싱 기능이
          추가될 예정입니다.
        </p>
        <p style={{ marginTop: 0, marginBottom: 12 }}>
          현재는 UI 뼈대만 준비하는 단계이며 실제 업로드는 수행되지 않습니다.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          <label htmlFor="projectspec-file-input" style={{ fontWeight: 600 }}>
            ProjectSpec 파일 선택 (UI 뼈대)
          </label>
          <input
            id="projectspec-file-input"
            type="file"
            accept=".md,.doc,.docx"
            onChange={handleSelectFile}
          />
          <p style={{ margin: 0, color: "#555" }}>
            지원 예정 형식: <code>.md</code>, <code>.doc</code>, <code>.docx</code>
          </p>
          {selectedFileName ? (
            <p style={{ margin: 0 }}>
              선택된 파일: <strong>{selectedFileName}</strong>
            </p>
          ) : (
            <p style={{ margin: 0, color: "#555" }}>아직 선택된 파일이 없습니다.</p>
          )}
          {uploadMessage ? <p style={{ margin: 0, color: "#555" }}>{uploadMessage}</p> : null}
        </div>
      </section>
    </main>
  );
}
