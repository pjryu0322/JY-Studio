"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

type AdminConfig = Readonly<{
  configured: boolean;
  host: string;
  port: number;
  adminDatabase: string;
  platformManagementDatabase: string;
  generatedProjectDataDatabase: string;
  adminUsername: string;
  hasAdminPassword: boolean;
  sslMode: string;
  runtimeApiBaseUrl: string | null;
  projectDbPrefix: string;
}>;

export default function PlatformPostgresAdminPage() {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [envHint, setEnvHint] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"all" | "platform" | "projects" | null>(null);

  const load = useCallback(async () => {
    const res = await credentialsIncludeFetch("/api/admin/platform-postgres");
    const json = (await res.json()) as {
      success?: boolean;
      data?: { config?: AdminConfig; envHint?: string };
      message?: string;
    };
    if (json.success && json.data?.config) {
      setConfig(json.data.config);
      setEnvHint(String(json.data.envHint ?? ""));
    } else {
      setMessage(json.message ?? "설정을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runTest = async (action: "test" | "testPlatformManagement" | "testGeneratedProjectData) => {
    setBusy(action === "test" ? "all" : action === "testPlatformManagement" ? "platform" : "projects");
    setMessage(null);
    try {
      const res = await credentialsIncludeFetch("/api/admin/platform-postgres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      setMessage(json.message ?? (json.success ? "연결 성공" : "연결 실패"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ margin: "0 0 8px 0", fontSize: 13 }}>
        <Link href="/admin/platform-users">← 플랫폼 관리</Link>
      </p>
      <h1 style={{ fontSize: 20, margin: "0 0 12px 0" }}>인프라 설정 · PostgreSQL</h1>
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
        플랫폼 관리 DB(<code>jyorchestration</code>)와 생성 프로젝트 데이터 DB(<code>jyprojects</code>) 역할을
        분리합니다. 프로젝트 사용자는 접속 정보를 입력하지 않습니다.
      </p>
      {config ? (
        <dl style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div>
            <dt style={{ fontWeight: 700 }}>구성 상태</dt>
            <dd>{config.configured ? "환경 변수 설정됨" : "미구성"}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Host</dt>
            <dd>{config.host || "—"}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Port</dt>
            <dd>{config.port}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Platform management DB</dt>
            <dd>
              <code>{config.platformManagementDatabase}</code> — Prisma / 오케스트레이션 메타데이터
            </dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Generated project data DB</dt>
            <dd>
              <code>{config.generatedProjectDataDatabase}</code> — 프로젝트 schema·테이블·seed
            </dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Admin catalog DB</dt>
            <dd>{config.adminDatabase}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Admin Username</dt>
            <dd>{config.adminUsername || "—"}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Admin Password</dt>
            <dd>{config.hasAdminPassword ? "설정됨" : "없음"}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>SSL Mode</dt>
            <dd>{config.sslMode}</dd>
          </div>
        </dl>
      ) : null}
      {envHint ? (
        <p style={{ fontSize: 11, color: "#64748b" }}>
          환경 변수: <code>{envHint}</code>
        </p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void runTest("testPlatformManagement")}
          style={buttonStyle}
        >
          {busy === "platform" ? "테스트 중…" : "jyorchestration 연결 테스트"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void runTest("testGeneratedProjectData")}
          style={buttonStyle}
        >
          {busy === "projects" ? "테스트 중…" : "jyprojects 연결·schema 권한 테스트"}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => void runTest("test")} style={buttonStyleOutline}>
          {busy === "all" ? "테스트 중…" : "전체 테스트"}
        </button>
      </div>
      {message ? (
        <p style={{ marginTop: 12, fontSize: 12, whiteSpace: "pre-wrap" }} role="status">
          {message}
        </p>
      ) : null}
    </main>
  );
}

const buttonStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #0f766e",
  background: "#0d9488",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
};

const buttonStyleOutline: CSSProperties = {
  ...buttonStyle,
  background: "#fff",
  color: "#0f766e",
};
