"use client";

import Link from "next/link";
import UploadPanel from "@/components/jobs/UploadPanel";
import EntryCard from "@/components/entry/EntryCard";
import ScreenLabel from "@/components/entry/ScreenLabel";
import { useRecentJobs } from "@/components/entry/useRecentJobs";

export default function WorkspacePage() {
  const { jobs } = useRecentJobs();
  const recentJob = jobs[0] ?? null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 0% 0%, rgba(73, 127, 255, 0.08) 0, transparent 28%), #f5f7fb",
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
        <header
          style={{
            border: "1px solid rgba(87, 120, 255, 0.24)",
            borderRadius: 22,
            background: "linear-gradient(165deg, #ffffff 0%, #f6faff 100%)",
            padding: 22,
            boxShadow: "0 16px 30px rgba(17, 31, 64, 0.08)",
            textAlign: "center",
          }}
        >
          <ScreenLabel screen="작업공간" mode="Operator" context="Operator Landing" />
          <h1 style={{ margin: "12px 0 6px", fontSize: 34, color: "#102544", letterSpacing: "-0.02em" }}>
            Operator
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#5b667c" }}>
            업로드 후 작업을 이어서 Chunk Workbench로 진입하세요.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <EntryCard
            variant="operator"
            title="새 문서 업로드"
            description={["문서를 업로드하고", "청킹 작업을 시작합니다."]}
            href="#upload-entry"
            supportingText="업로드 영역으로 이동"
          />
          <EntryCard
            variant="operator"
            title="최근 작업 이어가기"
            description={["가장 최근 작업으로", "바로 워크벤치에 진입합니다."]}
            href={recentJob ? `/jobs/${recentJob.id}` : "/jobs"}
            supportingText={recentJob ? "작업 상세로 이동" : "최근 작업 목록으로 이동"}
          />
          <EntryCard
            variant="operator"
            title="작업 목록 확인"
            description={["전체 작업 현황을 확인하고", "원하는 작업을 선택합니다."]}
            href="/jobs"
            supportingText="최근 작업 화면으로 이동"
          />
        </section>

        <section
          id="upload-entry"
          style={{
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: 22,
            background: "#fff",
            boxShadow: "0 12px 24px rgba(15, 23, 42, 0.06)",
            padding: 16,
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <strong style={{ fontSize: 14, color: "#122549" }}>업로드</strong>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              문서를 업로드하고 청킹 파이프라인을 시작합니다.
            </div>
          </div>
          <UploadPanel />
        </section>

        <div style={{ textAlign: "center" }}>
          <Link href="/" style={{ fontSize: 12, color: "#3156b9", textDecoration: "none" }}>
            역할 선택으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
