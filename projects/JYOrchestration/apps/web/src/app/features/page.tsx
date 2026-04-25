"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { fetchProjectById } from "@/components/project-spec/api";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowDemoSampleBanner } from "@/components/workflow/primitives/WorkflowDemoSampleBanner";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

function FeaturesPageInner() {
  const search = useSearchParams();
  const projectId = String(search?.get("projectId") ?? "").trim();
  const [flowSummary, setFlowSummary] = useState<{ approved: number; total: number; titles: string[] } | null>(null);

  useEffect(() => {
    if (!projectId) {
      setFlowSummary(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { project } = await fetchProjectById(projectId);
      if (cancelled) return;
      const state = parseRequirementsStateJson(project?.requirementsStateJson);
      const flow = state.serviceFlowV1 ?? null;
      if (!flow || !Array.isArray(flow.steps) || flow.steps.length === 0) {
        setFlowSummary(null);
        return;
      }
      const total = flow.steps.length;
      const approved = flow.steps.filter((s) => s.approved).length;
      const titles = flow.steps
        .filter((s) => s.approved)
        .sort((a, b) => a.order - b.order)
        .slice(0, 6)
        .map((s) => s.title);
      setFlowSummary({ approved, total, titles });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div>
      <WorkflowPageHeader
        title="기능 정리"
        subtitle="아이디어가 정리되고 스펙이 확정되면, 기능 단위로 나뉘어 작업 정리·생성 준비로 이어집니다."
      />

      <div style={{ marginTop: 12, marginBottom: 4 }}>
        <ProjectWorkflowNav />
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        {projectId ? (
          <WorkflowCard padding={16}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>서비스 흐름(입력)</div>
            {flowSummary ? (
              <>
                <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6 }}>
                  승인됨: <strong style={{ color: "#0f172a" }}>{flowSummary.approved}</strong> / {flowSummary.total}
                </div>
                {flowSummary.titles.length ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    {flowSummary.titles.map((t) => (
                      <div key={t} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                        {t}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>아직 승인된 단계가 없습니다. 먼저 흐름 단계를 승인해 주세요.</div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
                아직 “액터 및 서비스 흐름 정의” 단계 출력이 없습니다. 기능은 흐름에서 파생됩니다.
              </div>
            )}
          </WorkflowCard>
        ) : null}

        <WorkflowCard padding={16}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>시작 안내</div>
          <ul style={{ margin: "0 0 14px 0", paddingLeft: 20, fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
            <li>기능 목록은 아이디어 승인·스펙 확정 후 자동으로 후보가 쌓이도록 설계되어 있습니다.</li>
            <li>생성 준비(프로젝트 허브)에서 AI로 스펙을 생성·확정하면 이후 단계가 자연스럽게 열립니다.</li>
            <li>단계 이동은 상단 탭에서만 수행합니다.</li>
          </ul>
        </WorkflowCard>

        <WorkflowCard padding={16}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>수동·초안</div>
          <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            기능 목록의 직접 편집 UI는 생성 준비·스펙 워크스페이스와 연결해 확장할 예정입니다. 지금은 생성 준비 화면에서 텍스트로
            아이디어를 구체화하는 것이 가장 빠른 경로입니다.
          </p>
        </WorkflowCard>

        <details style={{ borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 14px", background: "#fff" }}>
          <summary style={{ cursor: "pointer", fontWeight: 900, fontSize: 14, color: "#1e3a8a" }}>
            샘플 구조 보기 (데모)
          </summary>
          <WorkflowDemoSampleBanner>아래 카드는 UI 예시용 샘플이며 실제 데이터가 아닙니다.</WorkflowDemoSampleBanner>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {["회의록 업로드", "요약·액션 추출", "권한 관리"].map((title) => (
              <div
                key={title}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px dashed #cbd5e1",
                  background: "#f8fafc",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#334155",
                }}
              >
                {title} <span style={{ fontWeight: 600, color: "#64748b" }}>· 우선순위 P1 (샘플)</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <Suspense fallback={null}>
      <FeaturesPageInner />
    </Suspense>
  );
}
