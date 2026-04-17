"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchProjectById } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { isNextPublicDevWorkflowToolsEnabled } from "@/lib/env/devWorkflowTools";
import { REQUIREMENTS_DELIBERATION_QUESTIONS } from "@/lib/project/requirementsDeliberationQuestions";
import { joinRequirementsDescription, splitRequirementsDescription } from "@/lib/project/requirementsDescriptionSplit";
import { buildLocalStructuredDraftFromIdea } from "@/lib/project/requirementsLocalAiDraft";
import {
  projectMeetsRequirementsAnalysisComplete,
  requirementsAnalysisChecklist,
  type RequirementsAnalysisFieldSlice,
} from "@/lib/project/requirementsAnalysisGate";
import { joinSuccessCriteriaAndNfr, splitSuccessCriteriaAndNfr } from "@/lib/project/requirementsSuccessCriteriaSplit";
import { isRequirementsPendingWorkflow } from "@/lib/project/projectWorkflowStatus";
import { APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT } from "@/lib/workflow/appFlowModel";

function notifyAppFlowProjectContextChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT));
}

const card: CSSProperties = {
  marginBottom: 16,
  padding: "20px 22px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

const label: CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 };

const textarea: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  fontFamily: "inherit",
  resize: "vertical",
};

const btnPrimary: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const btnGhost: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid #7c3aed",
  background: "#fff",
  color: "#6d28d9",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

export function RequirementsWorkspaceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showScreenLabels = useShowScreenLabels();
  const projectId = String(searchParams.get("projectId") ?? "").trim();
  const workflowNotice = String(searchParams.get("workflowNotice") ?? "").trim();

  const [hydrated, setHydrated] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [overview, setOverview] = useState("");
  const [deliberation, setDeliberation] = useState("");
  const [goals, setGoals] = useState("");
  const [scopeIn, setScopeIn] = useState("");
  const [scopeOut, setScopeOut] = useState("");
  const [targetUsers, setTargetUsers] = useState("");
  const [success, setSuccess] = useState("");
  const [nfr, setNfr] = useState("");
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({});
  const [structuredOpen, setStructuredOpen] = useState(false);
  const [deliberationOpen, setDeliberationOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearQuery = useCallback(() => {
    router.replace("/requirements");
  }, [router]);

  useEffect(() => {
    if (!projectId) {
      setHydrated(true);
      setProject(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { project: p } = await fetchProjectById(projectId);
      if (cancelled) return;
      if (!p) {
        setProject(null);
        setHydrated(true);
        return;
      }
      setProject(p);
      const split = splitRequirementsDescription(p.description);
      setOverview(split.base);
      setDeliberation(split.deliberation);
      setGoals(String(p.specCoreGoals ?? "").trim());
      setScopeIn(String(p.specScopeIn ?? "").trim());
      setScopeOut(String(p.specScopeOut ?? "").trim());
      setTargetUsers(String(p.specTargetUsers ?? "").trim());
      const sc = splitSuccessCriteriaAndNfr(p.specSuccessCriteria);
      setSuccess(sc.success);
      setNfr(sc.nfr);
      setStructuredOpen(true);
      setDeliberationOpen(Boolean(split.deliberation.trim()));
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const analysisSlice = useMemo((): RequirementsAnalysisFieldSlice => {
    const description = joinRequirementsDescription(overview, deliberation);
    return {
      description: description.trim() ? description : null,
      specCoreGoals: goals.trim() || null,
      specScopeIn: scopeIn.trim() || null,
      specScopeOut: scopeOut.trim() || null,
      specTargetUsers: targetUsers.trim() || null,
      specSuccessCriteria: joinSuccessCriteriaAndNfr(success, nfr).trim() || null,
      confirmedSpecMarkdown: project?.confirmedSpecMarkdown ?? null,
    };
  }, [overview, deliberation, goals, scopeIn, scopeOut, targetUsers, success, nfr, project?.confirmedSpecMarkdown]);

  const checklist = useMemo(() => requirementsAnalysisChecklist(analysisSlice), [analysisSlice]);
  const analysisComplete = useMemo(() => projectMeetsRequirementsAnalysisComplete(analysisSlice), [analysisSlice]);
  const requirementsPending = project ? isRequirementsPendingWorkflow(project.workflowStatus) : false;

  const patchPayload = useCallback(() => {
    const description = joinRequirementsDescription(overview, deliberation);
    return {
      description: description.trim() ? description : null,
      specCoreGoals: goals.trim() || null,
      specScopeIn: scopeIn.trim() || null,
      specScopeOut: scopeOut.trim() || null,
      specTargetUsers: targetUsers.trim() || null,
      specSuccessCriteria: joinSuccessCriteriaAndNfr(success, nfr).trim() || null,
    };
  }, [overview, deliberation, goals, scopeIn, scopeOut, targetUsers, success, nfr]);

  const savePatch = useCallback(async (): Promise<Project | null> => {
    if (!projectId) return null;
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/spec-workspace`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchPayload()),
    });
    const json = (await res.json()) as {
      success?: boolean;
      message?: string;
      data?: { project?: Project };
    };
    if (!res.ok || !json.success || !json.data?.project) {
      throw new Error(json.message || "저장에 실패했습니다.");
    }
    setProject(json.data.project);
    notifyAppFlowProjectContextChanged();
    return json.data.project;
  }, [projectId, patchPayload]);

  const onDraftSave = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      await savePatch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [projectId, savePatch]);

  const onAiOrganize = useCallback(() => {
    setDeliberationOpen(true);
    setStructuredOpen(true);
    const draft = buildLocalStructuredDraftFromIdea(overview);
    setGoals((g) => (g.trim() ? g : draft.specCoreGoals));
    setScopeIn((s) => (s.trim() ? s : draft.specScopeIn));
    setScopeOut((s) => (s.trim() ? s : draft.specScopeOut));
    setTargetUsers((t) => (t.trim() ? t : draft.specTargetUsers));
    setSuccess((u) => (u.trim() ? u : draft.specSuccessCriteria));
  }, [overview]);

  const onDirectWrite = useCallback(() => {
    setStructuredOpen(true);
  }, []);

  const appendDeliberation = useCallback((question: string, answer: string) => {
    const a = answer.trim();
    if (!a) return;
    const block = `### ${question}\n${a}\n\n`;
    setDeliberation((prev) => (prev.trim() ? `${prev.trim()}\n\n${block}` : block));
  }, []);

  const onConfirmRequirements = useCallback(async () => {
    if (!projectId) return;
    if (!analysisComplete) {
      setError("필수 항목을 모두 채운 뒤 임시 저장하고 요구사항을 확정할 수 있습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await savePatch();
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflow/confirm-requirements`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; message?: string; data?: Project };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "요구사항 확정에 실패했습니다.");
      }
      setProject(json.data);
      notifyAppFlowProjectContextChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [projectId, analysisComplete, savePatch]);

  const onGotoCollaboration = useCallback(async () => {
    if (!projectId) return;
    if (requirementsPending) {
      setError("먼저 요구사항을 확정해야 다음 단계로 진행할 수 있습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await savePatch();
      router.push("/collaboration");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [projectId, requirementsPending, savePatch, router]);

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
      notifyAppFlowProjectContextChanged();
      router.push(`/projects/${encodeURIComponent(projectId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [projectId, router]);

  if (!projectId) {
    return (
      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 17, fontWeight: 800 }}>프로젝트를 선택해 주세요</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
          요구사항 작업 공간은 생성한 프로젝트와 함께 열립니다. 홈에서 프로젝트를 만들거나 목록에서 열어 주세요.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link href="/" style={{ ...btnPrimary, display: "inline-block", textDecoration: "none" }}>
            실행 계획(홈)으로 이동
          </Link>
        </div>
      </section>
    );
  }

  if (!hydrated) {
    return (
      <section style={{ marginTop: 16, padding: 16, color: "#64748b", fontSize: 14 }} role="status">
        프로젝트 요구사항 정보를 불러오는 중…
      </section>
    );
  }

  const stepStrip = (
    <div
      style={{
        marginTop: 12,
        marginBottom: 4,
        fontSize: 12,
        fontWeight: 700,
        color: "#64748b",
        letterSpacing: 0.02,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span style={{ color: "#0f172a" }}>생각</span>
      <span aria-hidden>→</span>
      <span style={{ color: "#0f172a" }}>숙의</span>
      <span aria-hidden>→</span>
      <span style={{ color: "#0f172a" }}>정의</span>
      <span aria-hidden>→</span>
      <span style={{ color: "#0f172a" }}>확정</span>
    </div>
  );

  return (
    <div data-testid="requirements-project-intake" style={{ marginTop: 16 }}>
      {stepStrip}

      {workflowNotice ? (
        <p style={{ margin: "12px 0 0 0", padding: "12px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", fontWeight: 600, fontSize: 14 }} role="status">
          {workflowNotice}
        </p>
      ) : null}

      <section style={{ ...card, position: "relative", marginTop: 14 }}>
        <ScreenLabel label="요구사항-아이디어입력-섹션" visible={showScreenLabels} />
        <h2 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 900 }}>무엇을 만들고 싶나요?</h2>
        <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          만들고 싶은 서비스나 문제를 있는 그대로 적어 주세요. 아래에서 AI 가이드와 함께 다듬고, 구조화된 요구사항으로 옮길 수 있습니다.
        </p>
        <label htmlFor="requirements-idea-hero" style={label}>
          아이디어 · 한 줄 소개부터 길게까지 자유롭게
        </label>
        <textarea
          id="requirements-idea-hero"
          data-testid="requirements-project-idea-textarea"
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          placeholder={"예시:\n• 회의록을 자동 정리하는 SaaS\n• 사용자 정보 관리 웹 서비스\n• AI 고객 상담 챗봇"}
          rows={6}
          style={{ ...textarea, minHeight: 140 }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          <button type="button" disabled={busy} onClick={onAiOrganize} style={btnGhost}>
            AI와 함께 정리하기
          </button>
          <button type="button" disabled={busy} onClick={onDirectWrite} style={btnSecondary}>
            직접 작성 시작
          </button>
        </div>
      </section>

      <section style={{ ...card, position: "relative" }}>
        <ScreenLabel label="요구사항-AI숙의-섹션" visible={showScreenLabels} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>AI와의 숙의</h2>
          <button type="button" disabled={busy} onClick={() => setDeliberationOpen((v) => !v)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 13 }}>
            {deliberationOpen ? "접기" : "펼치기"}
          </button>
        </div>
        <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          질문에 답하면 내용이 아래 「숙의 기록」에 쌓입니다. 저장 시 프로젝트 설명에 함께 보관됩니다.
        </p>
        {deliberationOpen ? (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {REQUIREMENTS_DELIBERATION_QUESTIONS.map((q) => (
              <div
                key={q.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{q.prompt}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{q.hint}</div>
                <textarea
                  value={questionDrafts[q.id] ?? ""}
                  onChange={(e) => setQuestionDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                  rows={2}
                  style={{ ...textarea, marginTop: 10 }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    appendDeliberation(q.prompt, questionDrafts[q.id] ?? "");
                    setQuestionDrafts((d) => ({ ...d, [q.id]: "" }));
                  }}
                  style={{ ...btnSecondary, marginTop: 8, padding: "8px 12px", fontSize: 13 }}
                >
                  이 답변을 숙의에 추가
                </button>
              </div>
            ))}
            <div>
              <label htmlFor="requirements-deliberation-log" style={label}>
                숙의 기록 (직접 편집 가능)
              </label>
              <textarea
                id="requirements-deliberation-log"
                value={deliberation}
                onChange={(e) => setDeliberation(e.target.value)}
                rows={5}
                style={textarea}
              />
            </div>
          </div>
        ) : null}
      </section>

      {structuredOpen ? (
        <section style={{ ...card, position: "relative" }}>
          <ScreenLabel label="요구사항-구조화결과-섹션" visible={showScreenLabels} />
          <h2 style={{ margin: "0 0 6px 0", fontSize: 17, fontWeight: 900 }}>구조화된 요구사항</h2>
          <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#475569" }}>
            아래 블록은 실행·협업 단계에서 그대로 참고됩니다. 문장을 다듬어 팀과 공유해 주세요.
          </p>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={label}>프로젝트 개요</label>
              <textarea value={overview} onChange={(e) => setOverview(e.target.value)} rows={4} style={textarea} />
            </div>
            <div>
              <label style={label}>목표</label>
              <textarea
                data-testid="requirements-spec-goals"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="이 프로젝트가 달성하려는 가치·변화를 적어 주세요."
                rows={3}
                style={textarea}
              />
            </div>
            <div>
              <label style={label}>대상 사용자</label>
              <textarea
                data-testid="requirements-target-users"
                value={targetUsers}
                onChange={(e) => setTargetUsers(e.target.value)}
                rows={3}
                style={textarea}
              />
            </div>
            <div>
              <label style={label}>핵심 기능 · 포함 범위</label>
              <textarea data-testid="requirements-scope-in" value={scopeIn} onChange={(e) => setScopeIn(e.target.value)} rows={3} style={textarea} />
            </div>
            <div>
              <label style={label}>제외 범위</label>
              <textarea data-testid="requirements-scope-out" value={scopeOut} onChange={(e) => setScopeOut(e.target.value)} rows={3} style={textarea} />
            </div>
            <div>
              <label style={label}>비기능 요구사항</label>
              <textarea
                data-testid="requirements-nfr"
                value={nfr}
                onChange={(e) => setNfr(e.target.value)}
                placeholder="성능, 보안, 가용성 등"
                rows={2}
                style={textarea}
              />
            </div>
            <div>
              <label style={label}>성공 기준</label>
              <textarea
                data-testid="requirements-success-criteria"
                value={success}
                onChange={(e) => setSuccess(e.target.value)}
                rows={2}
                style={textarea}
              />
            </div>
          </div>

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#475569" }}>필수 항목 체크</summary>
            <ul style={{ margin: "10px 0 0 0", paddingLeft: 20, fontSize: 13, color: "#334155" }}>
              {checklist.map((c) => (
                <li key={c.id} style={{ marginBottom: 4 }}>
                  {c.done ? "✓ " : "○ "}
                  {c.label}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}

      <section style={{ ...card }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button type="button" disabled={busy} onClick={() => void onDraftSave()} style={btnSecondary}>
            임시 저장
          </button>
          <div className="relative" style={{ position: "relative" }}>
            <ScreenLabel label="요구사항-확정-버튼" visible={showScreenLabels} />
            <button
              type="button"
              disabled={busy || !analysisComplete}
              data-testid="requirements-confirm-button"
              onClick={() => void onConfirmRequirements()}
              style={{
                ...btnPrimary,
                opacity: analysisComplete ? 1 : 0.55,
                cursor: busy ? "wait" : analysisComplete ? "pointer" : "not-allowed",
              }}
            >
              요구사항 확정
            </button>
          </div>
        </div>
        {!analysisComplete ? (
          <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#64748b" }}>필수 항목을 채우면 「요구사항 확정」을 누를 수 있습니다.</p>
        ) : null}
      </section>

      {!requirementsPending ? (
        <section style={{ ...card, borderColor: "#bbf7d0", background: "#f0fdf4" }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 900, color: "#14532d" }}>요구사항이 확정되었습니다</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#166534", lineHeight: 1.6 }}>
            다음 단계: 협업 단계로 이동하여 세부 논의를 진행하세요.
          </p>
          <div style={{ marginTop: 14 }}>
            <button type="button" disabled={busy} data-testid="requirements-goto-collaboration" onClick={() => void onGotoCollaboration()} style={btnPrimary}>
              협업으로 이동
            </button>
          </div>
        </section>
      ) : (
        <p style={{ margin: "12px 0", fontSize: 13, color: "#64748b" }}>
          협업·실행 계획 등 다음 단계는 요구사항을 확정한 뒤에 열립니다. 상단 워크플로에서 잠긴 단계에 마우스를 올리면 안내 문구를 볼 수 있습니다.
        </p>
      )}

      {isNextPublicDevWorkflowToolsEnabled() ? (
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1px dashed #fca5a5", fontSize: 12, color: "#991b1b" }}>
          <strong>개발 전용</strong> — 요구사항 단계를 건너뛰고 프로젝트 상세로 이동합니다.{" "}
          <button type="button" disabled={busy} onClick={() => void ackAndOpenProject()} style={{ border: 0, background: "none", color: "#b91c1c", fontWeight: 700, cursor: busy ? "wait" : "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}>
            (DEV) 요구사항 단계 강제 해제
          </button>
        </div>
      ) : null}

      <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
        <button type="button" onClick={clearQuery} style={{ border: 0, background: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}>
          안내 배너 닫기 (주소에서 공지 제거)
        </button>
      </div>

      {error ? (
        <p style={{ margin: "12px 0 0 0", color: "#b91c1c", fontWeight: 600 }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
