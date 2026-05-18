"use client";

import Link from "next/link";
import { useState } from "react";

export default function FindLoginIdPage() {
  const [name, setName] = useState("");
  const [emailLocalPrefix, setEmailLocalPrefix] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMaskedEmail(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/find-login-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          emailLocalPrefix: emailLocalPrefix.trim() || undefined,
          emailDomain: emailDomain.trim().replace(/^@/, "") || undefined,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { maskedEmail?: string };
      };
      if (!res.ok || !json.success) {
        setError(json.message || "조회에 실패했습니다.");
        return;
      }
      const m = json.data?.maskedEmail?.trim();
      if (m) setMaskedEmail(m);
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
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0" }}>아이디(이메일) 찾기</h1>
        <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: 14, lineHeight: 1.55 }}>
          로그인 ID는 <strong>이메일 주소</strong>입니다. 가입 시 입력한 이름으로 조회할 수 있습니다. 동명이인 계정이 여러 개이면 이메일 앞부분·도메인을
          함께 입력해 주세요.
        </p>
        {error ? <p style={{ color: "#b00020", margin: "0 0 16px 0", fontSize: 14 }}>{error}</p> : null}
        {maskedEmail ? (
          <p style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
            조회된 이메일: <span style={{ color: "#0d9488" }}>{maskedEmail}</span>
          </p>
        ) : null}
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: "grid", gap: 14 }}>
          <input
            type="text"
            autoComplete="name"
            placeholder="이름 (가입 시 입력)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            required
            style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <input
            type="text"
            autoComplete="off"
            placeholder="이메일 앞부분 (선택, 예: pj)"
            value={emailLocalPrefix}
            onChange={(e) => setEmailLocalPrefix(e.target.value)}
            disabled={submitting}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <input
            type="text"
            autoComplete="off"
            placeholder="이메일 도메인 (선택, 예: gmail.com)"
            value={emailDomain}
            onChange={(e) => setEmailDomain(e.target.value)}
            disabled={submitting}
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
            {submitting ? "처리 중..." : "조회"}
          </button>
        </form>
        <p style={{ margin: "20px 0 0", textAlign: "center", fontSize: 13 }}>
          <Link href="/login/forgot-password" style={{ color: "#2563eb", fontWeight: 700, marginRight: 12 }}>
            비밀번호 재설정
          </Link>
          <Link href="/login" style={{ color: "#2563eb", fontWeight: 700 }}>
            ← 로그인으로
          </Link>
        </p>
      </div>
    </main>
  );
}
