"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

type AdminConfig = Readonly<{
  configured: boolean;
  host: string;
  port: number;
  adminDatabase: string;
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
  const [busy, setBusy] = useState(false);

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

  const runTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await credentialsIncludeFetch("/api/admin/platform-postgres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      setMessage(json.message ?? (json.success ? "연결 성공" : "연결 실패"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ margin: "0 0 8px 0", fontSize: 13 }}>
        <Link href="/admin/platform-users">← 플랫폼 관리</Link>
      </p>
      <h1 style={{ fontSize: 20, margin: "0 0 12px 0" }}>인프라 설정 · PostgreSQL</h1>
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
        프로젝트 사용자는 접속 정보를 입력하지 않습니다. 아래 값은 서버 환경 변수로만 설정합니다.
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
            <dt style={{ fontWeight: 700 }}>Admin Database</dt>
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
          <div>
            <dt style={{ fontWeight: 700 }}>Project DB Prefix</dt>
            <dd>{config.projectDbPrefix}</dd>
          </div>
        </dl>
      ) : null}
      {envHint ? (
        <p style={{ fontSize: 11, color: "#64748b" }}>
          환경 변수: <code>{envHint}</code>
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void runTest()}
        style={{
          marginTop: 12,
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid #0f766e",
          background: "#0d9488",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        {busy ? "테스트 중…" : "관리자 연결 테스트"}
      </button>
      {message ? (
        <p style={{ marginTop: 12, fontSize: 12 }} role="status">
          {message}
        </p>
      ) : null}
    </main>
  );
}
