"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

type Tab = "login" | "register";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const redirectHome = useCallback(async () => {
    const from = searchParams.get("from")?.trim();
    if (from && from.startsWith("/") && !from.startsWith("//")) {
      router.replace(from);
      router.refresh();
      return;
    }
    router.replace("/");
    router.refresh();
  }, [router, searchParams]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setError(json.message || "로그인에 실패했습니다.");
        return;
      }
      await redirectHome();
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setError(json.message || "회원가입에 실패했습니다.");
        return;
      }
      await redirectHome();
    } catch {
      setError("회원가입 중 오류가 발생했습니다.");
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
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px 0" }}>
          JYOrchestration
        </h1>
        <p style={{ margin: "0 0 24px 0", color: "#666", fontSize: 14 }}>
          로그인 후 오케스트레이션을 사용할 수 있습니다.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: tab === "login" ? "2px solid #111" : "1px solid #ccc",
              background: tab === "login" ? "#111" : "#fafafa",
              color: tab === "login" ? "#fff" : "#333",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: tab === "register" ? "2px solid #111" : "1px solid #ccc",
              background: tab === "register" ? "#111" : "#fafafa",
              color: tab === "register" ? "#fff" : "#333",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            회원가입
          </button>
        </div>

        {error ? (
          <p style={{ color: "#b00020", margin: "0 0 16px 0", fontSize: 14 }}>{error}</p>
        ) : null}

        {tab === "login" ? (
          <form onSubmit={onLogin} style={{ display: "grid", gap: 14 }}>
            <input
              type="email"
              autoComplete="email"
              placeholder="이메일"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              disabled={submitting}
              required
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={submitting}
              required
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "none",
                background: "#111",
                color: "#fff",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "처리 중..." : "로그인"}
            </button>
          </form>
        ) : (
          <form onSubmit={onRegister} style={{ display: "grid", gap: 14 }}>
            <input
              type="text"
              autoComplete="name"
              placeholder="이름"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              disabled={submitting}
              required
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <input
              type="email"
              autoComplete="email"
              placeholder="이메일"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              disabled={submitting}
              required
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호 (8자 이상)"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              disabled={submitting}
              required
              minLength={8}
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "none",
                background: "#111",
                color: "#fff",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "처리 중..." : "가입하기"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#666" }}>불러오는 중...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
