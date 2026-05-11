"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = String(searchParams.get("token") ?? "").trim();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!token) {
      setError("유효한 재설정 링크가 아닙니다.");
      return;
    }
    if (password !== password2) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setError(json.message || "재설정에 실패했습니다.");
        return;
      }
      setInfo(json.message || "비밀번호가 변경되었습니다.");
      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f6f6f6",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e0e0e0",
          padding: 28,
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0" }}>새 비밀번호 설정</h1>
        <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: 14, lineHeight: 1.55 }}>
          비밀번호 재설정 링크로 이동한 화면입니다. 새 비밀번호를 입력해 주세요.
        </p>
        {!token ? <p style={{ color: "#b00020", margin: "0 0 16px 0", fontSize: 14 }}>링크에 토큰이 없습니다. 비밀번호 재설정을 다시 요청해 주세요.</p> : null}
        {error ? <p style={{ color: "#b00020", margin: "0 0 16px 0", fontSize: 14 }}>{error}</p> : null}
        {info ? <p style={{ color: "#166534", margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>{info}</p> : null}
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: "grid", gap: 14 }}>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="새 비밀번호 (8자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting || !token}
            required
            minLength={8}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="새 비밀번호 확인"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            disabled={submitting || !token}
            required
            minLength={8}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button
            type="submit"
            disabled={submitting || !token}
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              border: "none",
              background: "#111",
              color: "#fff",
              fontWeight: 600,
              cursor: submitting || !token ? "not-allowed" : "pointer",
              opacity: submitting || !token ? 0.7 : 1,
            }}
          >
            {submitting ? "처리 중..." : "비밀번호 변경"}
          </button>
        </form>
        <p style={{ margin: "20px 0 0", textAlign: "center", fontSize: 13 }}>
          <Link href="/login" style={{ color: "#2563eb", fontWeight: 700 }}>
            ← 로그인으로
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#64748b" }}>불러오는 중…</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
