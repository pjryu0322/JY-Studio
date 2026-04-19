"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type Tab = "login" | "register";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (searchParams.get("tab") === "register" ? "register" : "login"));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "register") setTab("register");
  }, [searchParams]);

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
    setInfo(null);
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
    setInfo(null);
    if (regPassword !== regPassword2) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
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
      setInfo("가입이 완료되었습니다. 홈으로 이동합니다…");
      setRegPassword2("");
      await redirectHome();
    } catch {
      setError("회원가입 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      data-ui-label="[L] Login Page"
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
        data-ui-label="[L-1] Login / Register Card"
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
          회원가입 후 프로젝트를 만들고 <strong>아이디어 구체화</strong>부터 진행할 수 있습니다.
        </p>

        <div data-ui-label="[L-2] Auth Tabs" style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            data-testid="auth-tab-login"
            onClick={() => {
              setTab("login");
              setError(null);
              setInfo(null);
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
            data-testid="auth-tab-register"
            onClick={() => {
              setTab("register");
              setError(null);
              setInfo(null);
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
        {info ? (
          <p style={{ color: "#166534", margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>{info}</p>
        ) : null}

        {tab === "login" ? (
          <form data-ui-label="[L-3] Login Form" onSubmit={onLogin} style={{ display: "grid", gap: 14 }}>
            <input
              type="email"
              autoComplete="email"
              placeholder="이메일"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              disabled={submitting}
              required
              data-testid="login-email"
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
              data-testid="login-password"
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <button
              type="submit"
              disabled={submitting}
              data-testid="login-submit"
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
            <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "#555" }}>
              계정이 없으신가요?{" "}
              <button
                type="button"
                data-testid="login-goto-register"
                onClick={() => {
                  setTab("register");
                  setError(null);
                  setInfo(null);
                }}
                style={{
                  border: 0,
                  background: "none",
                  padding: 0,
                  color: "#111",
                  fontWeight: 700,
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                회원가입
              </button>
            </p>
          </form>
        ) : (
          <form data-ui-label="[L-4] Register Form" onSubmit={onRegister} style={{ display: "grid", gap: 14 }}>
            <input
              type="text"
              autoComplete="name"
              placeholder="이름"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              disabled={submitting}
              required
              data-testid="register-name"
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
              data-testid="register-email"
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
              data-testid="register-password"
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호 확인"
              value={regPassword2}
              onChange={(e) => setRegPassword2(e.target.value)}
              disabled={submitting}
              required
              minLength={8}
              data-testid="register-password-confirm"
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <button
              type="submit"
              disabled={submitting}
              data-testid="register-submit"
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
            <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "#555" }}>
              이미 계정이 있으신가요?{" "}
              <button
                type="button"
                data-testid="register-goto-login"
                onClick={() => {
                  setTab("login");
                  setError(null);
                  setInfo(null);
                }}
                style={{
                  border: 0,
                  background: "none",
                  padding: 0,
                  color: "#111",
                  fontWeight: 700,
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                로그인
              </button>
            </p>
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
