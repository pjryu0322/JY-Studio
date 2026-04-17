"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export function RequirementsWorkflowGateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = String(searchParams.get("projectId") ?? "").trim();
  const workflowNotice = String(searchParams.get("workflowNotice") ?? "").trim();
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearQuery = useCallback(() => {
    router.replace("/requirements");
  }, [router]);

  const saveIdeaToProject = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;
    const text = idea.trim();
    if (!text) {
      setError("서비스/아이디어를 입력해 주세요.");
      return false;
    }
    setError(null);
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/spec-workspace`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ specCoreGoals: text }),
    });
    const json = (await res.json()) as { success?: boolean; message?: string };
    if (!res.ok || !json.success) {
      throw new Error(json.message || "저장에 실패했습니다.");
    }
    return true;
  }, [projectId, idea]);

  const onDirectWrite = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveIdeaToProject();
      if (!saved) return;
      router.push("/collaboration");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [projectId, router, saveIdeaToProject]);

  const onAiAssist = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveIdeaToProject();
      if (!saved) return;
      router.push(`/projects/${encodeURIComponent(projectId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [projectId, router, saveIdeaToProject]);

  const onNextCollaboration = useCallback(async () => {
    if (!projectId) return;
    if (!idea.trim()) {
      router.push("/collaboration");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveIdeaToProject();
      if (!saved) return;
      router.push("/collaboration");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [projectId, idea, router, saveIdeaToProject]);

  const ackAndOpenProject = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflow/ack-requirements`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "처리에 실패했습니다.");
      }
      router.push(`/projects/${encodeURIComponent(projectId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [projectId, router]);

  if (!projectId) {
    return null;
  }

  return (
    <section
      data-testid="requirements-project-intake"
      style={{
        marginBottom: 20,
        padding: "18px 20px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
        fontSize: 14,
        lineHeight: 1.6,
        color: "#0f172a",
      }}
    >
      <h2 style={{ margin: "0 0 12px 0", fontSize: 20, fontWeight: 800 }}>요구사항</h2>

      {workflowNotice ? (
        <p style={{ margin: "0 0 12px 0", color: "#b45309", fontWeight: 600 }} role="status">
          {workflowNotice}
        </p>
      ) : null}

      <p style={{ margin: "0 0 6px 0", fontWeight: 700, color: "#15803d" }}>프로젝트가 생성되었습니다.</p>
      <p style={{ margin: "0 0 14px 0", color: "#334155" }}>먼저 만들고 싶은 서비스/아이디어를 입력하세요.</p>

      <label htmlFor="requirements-project-idea" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
        아이디어 입력
      </label>
      <textarea
        id="requirements-project-idea"
        data-testid="requirements-project-idea-textarea"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="예: 팀 회의록을 자동 요약·액션 아이템으로 나누는 웹 서비스"
        rows={6}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          fontSize: 14,
          fontFamily: "inherit",
          resize: "vertical",
          minHeight: 120,
        }}
      />

      <div
        style={{
          marginTop: 10,
          padding: "10px 12px",
          borderRadius: 8,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          fontSize: 13,
          color: "#475569",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, color: "#334155" }}>예시</div>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>회의록을 자동 정리하는 SaaS</li>
          <li>사용자관리 웹서비스</li>
          <li>AI 상담 챗봇</li>
        </ul>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, alignItems: "center" }}>
        <button
          type="button"
          disabled={busy}
          data-testid="requirements-project-ai-assist"
          onClick={() => void onAiAssist()}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #7c3aed",
            background: "#7c3aed",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          AI와 함께 정리하기
        </button>
        <button
          type="button"
          disabled={busy}
          data-testid="requirements-project-direct-write"
          onClick={() => void onDirectWrite()}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #2563eb",
            background: "#fff",
            color: "#1d4ed8",
            fontWeight: 700,
            fontSize: 14,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          직접 작성하기
        </button>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => void onNextCollaboration()}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          다음 단계: 협업
        </button>
        <Link href="/collaboration" style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
          협업만 바로 열기 (저장 없음)
        </Link>
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #e2e8f0", fontSize: 12, color: "#64748b" }}>
        <span style={{ fontWeight: 700, color: "#475569" }}>실행 계획(프로젝트)</span>으로 바로 갈 때는 요구사항 대기를 해제해야 합니다.{" "}
        <button
          type="button"
          disabled={busy}
          onClick={() => void ackAndOpenProject()}
          style={{
            border: 0,
            background: "none",
            color: "#2563eb",
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
            textDecoration: "underline",
            padding: 0,
            font: "inherit",
          }}
        >
          요구사항 단계 건너뛰기 → 실행 계획
        </button>
        {" · "}
        <button type="button" onClick={clearQuery} style={{ border: 0, background: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}>
          배너 닫기
        </button>
      </div>

      {error ? (
        <p style={{ margin: "12px 0 0 0", color: "#b91c1c", fontWeight: 600 }} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
