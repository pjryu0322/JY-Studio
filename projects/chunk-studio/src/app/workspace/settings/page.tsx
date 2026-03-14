"use client";

import Link from "next/link";
import { useWorkspacePreferences } from "@/hooks/useWorkspacePreferences";

export default function WorkspaceSettingsPage() {
  const { showLabels, setShowLabels } = useWorkspacePreferences();

  return (
    <main style={{ minHeight: "100vh", padding: "32px 20px", background: "#f8fafc" }}>
      <section
        style={{
          maxWidth: 640,
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 20,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>작업공간 설정</h1>
          <Link href="/workspace" style={{ fontSize: 13, textDecoration: "none" }}>
            작업공간으로 돌아가기
          </Link>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ fontSize: 14, color: "#0f172a" }}>화면 라벨 표시</strong>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              분석/에디터 디버그 라벨을 화면에 표시합니다.
            </span>
          </div>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            aria-label="화면 라벨 표시 토글"
          />
        </label>
      </section>
    </main>
  );
}
