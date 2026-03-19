import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type ProjectDetailPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

const projectSpecPrompt = `너는 소프트웨어 아키텍트이자 요구사항 분석가야.
아래 프로젝트 정보를 기반으로 ProjectSpec 문서를 마크다운 형식으로 작성해줘.

반드시 다음 항목을 포함해:
1) 프로젝트 개요
2) 목표/범위 (In scope / Out of scope)
3) 사용자 및 핵심 유스케이스
4) 기능 요구사항 (우선순위 포함)
5) 비기능 요구사항 (성능, 보안, 운영)
6) 제약사항 및 가정
7) 성공 지표 및 수용 기준
8) 초기 마일스톤`;

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });

  if (!project) {
    notFound();
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
            <strong>프로젝트명:</strong> {project.name}
          </div>
          <div>
            <strong>설명:</strong> {project.description || "설명 없음"}
          </div>
          <div>
            <strong>Project Type:</strong> {project.projectType}
          </div>
          <div>
            <strong>Status:</strong> {project.status}
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
          ProjectSpec은 프로젝트의 목표, 범위, 요구사항을 한 문서로 정리하는 기준 문서입니다.
          이후 FeatureSpec/Task 계획의 기준점으로 사용됩니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          초기 단계에서 ProjectSpec을 명확히 작성하면 구현 범위를 통제하고 요구사항 누락을 줄일 수
          있습니다.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>프로젝트 목표와 범위</li>
          <li>핵심 사용자/유스케이스</li>
          <li>기능 요구사항과 우선순위</li>
          <li>비기능 요구사항(성능/보안/운영)</li>
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
          아래 프롬프트를 복사해 GPT에 전달하면 ProjectSpec 초안을 빠르게 만들 수 있습니다.
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
        <p style={{ margin: 0 }}>
          다음 단계에서 ProjectSpec 문서 업로드 및 파싱 기능이 추가될 예정입니다. 현재 단계에서는
          화면 뼈대만 제공합니다.
        </p>
      </section>
    </main>
  );
}
