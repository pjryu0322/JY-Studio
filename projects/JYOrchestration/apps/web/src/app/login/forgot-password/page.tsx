"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getEmailDomainTypoHint } from "@/lib/auth/emailTypoHints";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const trimmed = email.trim().toLowerCase();
    const typo = getEmailDomainTypoHint(trimmed);
    if (typo) {
      setError(typo);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        resetUrl?: string;
      };
      if (!res.ok || !json.success) {
        setError(json.message || "요청에 실패했습니다.");
        return;
      }
      const next = typeof json.resetUrl === "string" ? json.resetUrl.trim() : "";
      if (next) {
        router.replace(next);
        return;
      }
      setInfo(json.message || "요청이 접수되었습니다.");
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
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0" }}>비밀번호 재설정</h1>
        <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: 14, lineHeight: 1.55 }}>
          가입 시 사용한 이메일을 입력하세요. 메일 발송이 연결되어 있으면 안내 메일을 보내고, 그렇지 않으면{" "}
          <strong>이 브라우저에서 바로</strong> 새 비밀번호를 설정할 수 있습니다.
        </p>
        <p style={{ margin: "0 0 16px 0", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
          메일이 오지 않으면 <strong>도메인 철자</strong>(예: gmail.com)과 <strong>가입 여부</strong>를 확인해 주세요. Resend 등 메일 연동이 없으면
          곧바로 재설정 화면으로 넘어갑니다.
        </p>
        {error ? <p style={{ color: "#b00020", margin: "0 0 16px 0", fontSize: 14 }}>{error}</p> : null}
        {info ? <p style={{ color: "#166534", margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>{info}</p> : null}
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: "grid", gap: 14 }}>
          <input
            type="email"
            autoComplete="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {submitting ? "처리 중..." : "다음"}
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
