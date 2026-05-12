"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { KnowledgePacksManageAiDraftSection } from "./KnowledgePacksManageAiDraftSection";
import { KnowledgePackSourceManager } from "./KnowledgePackSourceManager";
import { applyKnowledgePackDraftResult } from "@/lib/knowledge-packs/knowledgePackDraftApply";
import { generateKnowledgePackDraftMock, type KnowledgePackDraftResult } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";
import { formatReferences } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import {
  buildKnowledgePackDraftInputFromWizard,
  buildKnowledgePackPrecheckInputFromWizard,
  interpretKnowledgePackDraftApiResponse,
  knowledgePackDraftClientMessages,
  requestKnowledgePackDraftApi,
  requestKnowledgePackPrecheckApi,
} from "@/lib/knowledge-packs/knowledgePackManageDraftClient";
import { inferLicenseTypeFromHint } from "@/lib/knowledge-packs/knowledgePackManageFormHelpers";
import type { KnowledgePackPrecheckResult } from "@/lib/knowledge-packs/knowledgePackPrecheckTypes";
import type { KnowledgePack, KnowledgePackCategory } from "@/lib/knowledge-packs/types";

const SCOPES = ["USER", "PROJECT"] as const;
const CATEGORIES = ["GRID", "AUTH", "SECURITY", "UI", "API", "DATA", "INTEGRATION"] as const;
const LICENSES = ["MIT", "OPEN_SOURCE", "COMMERCIAL", "PARTNER_LICENSE", "USER_PROVIDED_LICENSE", "EXTERNAL_SERVICE", "UNKNOWN"] as const;
const STATUSES = ["DRAFT", "ACTIVE", "REVIEW_REQUESTED", "APPROVED", "ARCHIVED"] as const;

function ta(rows: readonly string[]): string {
  return rows.join("\n");
}

function fieldStyle(): CSSProperties {
  return {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    fontSize: 13,
    fontFamily: "inherit",
  };
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <details
      open
      style={{
        marginBottom: 12,
        border: `1px solid ${t.border}`,
        borderRadius: t.radiusMd,
        padding: "10px 12px",
        background: t.bgCard,
        maxWidth: "100%",
      }}
    >
      <summary style={{ fontWeight: 900, fontSize: 13, color: t.textPrimary, cursor: "pointer" }}>{title}</summary>
      <div style={{ marginTop: 10 }}>{children}</div>
    </details>
  );
}

export function KnowledgePacksManagePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = useMemo(() => String(searchParams.get("id") ?? "").trim(), [searchParams]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [precheckBusy, setPrecheckBusy] = useState(false);
  const [precheckResult, setPrecheckResult] = useState<KnowledgePackPrecheckResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dbPacks, setDbPacks] = useState<KnowledgePack[]>([]);

  const [name, setName] = useState("");
  const [scope, setScope] = useState<string>("USER");
  const [category, setCategory] = useState<string>("GRID");
  const [vendor, setVendor] = useState("");
  const [licenseType, setLicenseType] = useState<string>("MIT");
  const [status, setStatus] = useState<string>("DRAFT");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [licenseNotes, setLicenseNotes] = useState("");
  const [agents, setAgents] = useState("AI_DEVELOPER");
  const [changeSummary, setChangeSummary] = useState("");

  const [aiProductUrl, setAiProductUrl] = useState("");
  const [aiPurpose, setAiPurpose] = useState("");
  const [aiOfficialDocsUrl, setAiOfficialDocsUrl] = useState("");
  const [aiApiDocsUrl, setAiApiDocsUrl] = useState("");
  const [aiRepositoryUrl, setAiRepositoryUrl] = useState("");
  const [aiLicenseHint, setAiLicenseHint] = useState("");
  const [aiMemo, setAiMemo] = useState("");
  const [lastSourceCandidates, setLastSourceCandidates] = useState("");
  const [lastDraftWarnings, setLastDraftWarnings] = useState<readonly string[]>([]);

  const [recommendedUseCases, setRecommendedUseCases] = useState("");
  const [notRecommendedUseCases, setNotRecommendedUseCases] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [constraints, setConstraints] = useState("");
  const [implementationGuidelines, setImplementationGuidelines] = useState("");
  const [cursorPromptRules, setCursorPromptRules] = useState("");
  const [forbiddenPatterns, setForbiddenPatterns] = useState("");
  const [reviewChecklist, setReviewChecklist] = useState("");
  const [securityChecklist, setSecurityChecklist] = useState("");
  const [alternatives, setAlternatives] = useState("");
  const [references, setReferences] = useState("");
  const [previewSpec, setPreviewSpec] = useState("");

  const resetEmpty = useCallback(() => {
    setName("");
    setScope("USER");
    setCategory("GRID");
    setVendor("");
    setLicenseType("MIT");
    setStatus("DRAFT");
    setSummary("");
    setDescription("");
    setLicenseNotes("");
    setAgents("AI_DEVELOPER");
    setChangeSummary("");
    setRecommendedUseCases("");
    setNotRecommendedUseCases("");
    setCapabilities("");
    setConstraints("");
    setImplementationGuidelines("");
    setCursorPromptRules("");
    setForbiddenPatterns("");
    setReviewChecklist("");
    setSecurityChecklist("");
    setAlternatives("");
    setReferences("");
    setPreviewSpec("");
    setAiProductUrl("");
    setAiPurpose("");
    setAiOfficialDocsUrl("");
    setAiApiDocsUrl("");
    setAiRepositoryUrl("");
    setAiLicenseHint("");
    setAiMemo("");
    setLastSourceCandidates("");
    setLastDraftWarnings([]);
    setPrecheckResult(null);
  }, []);

  const loadDbList = useCallback(async () => {
    try {
      const r = await fetch("/api/knowledge-packs");
      const j = (await r.json()) as { ok?: boolean; packs?: KnowledgePack[] };
      if (j.ok && Array.isArray(j.packs)) {
        setDbPacks(j.packs.filter((p) => p.source === "DB"));
      }
    } catch {
      setDbPacks([]);
    }
  }, []);

  const fillFromPack = useCallback((p: KnowledgePack) => {
    setName(p.name);
    setScope(p.scope);
    setCategory(p.category);
    setVendor((p as KnowledgePack & { vendor?: string }).vendor ?? "");
    setLicenseType(p.license.type === "OPEN_SOURCE" ? "OPEN_SOURCE" : p.license.type);
    setStatus(p.status);
    setSummary(p.summary);
    setDescription((p as KnowledgePack & { description?: string }).description ?? "");
    setLicenseNotes(ta(p.license.notes));
    setAgents(p.agents.join("\n"));
    setRecommendedUseCases(ta(p.recommendedUseCases));
    setNotRecommendedUseCases(ta(p.notRecommendedUseCases));
    setCapabilities(ta(p.capabilities));
    setConstraints(ta(p.constraints));
    setImplementationGuidelines(ta(p.implementationGuidelines));
    setCursorPromptRules(ta(p.cursorPromptRules));
    setForbiddenPatterns(ta(p.forbiddenPatterns));
    setReviewChecklist(ta(p.reviewChecklist));
    setSecurityChecklist(ta(p.securityChecklist ?? []));
    setAlternatives(ta(p.alternatives));
    setReferences(formatReferences(p.references));
    setPreviewSpec(p.previewSpec ?? "");
    setAiProductUrl("");
    setAiPurpose("");
    setAiOfficialDocsUrl("");
    setAiApiDocsUrl("");
    setAiRepositoryUrl("");
    setAiLicenseHint("");
    setAiMemo("");
    setLastSourceCandidates("");
    setLastDraftWarnings([]);
    setPrecheckResult(null);
  }, []);

  useEffect(() => {
    void loadDbList();
  }, [loadDbList]);

  useEffect(() => {
    if (!editId || !editId.startsWith("kp_")) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`/api/knowledge-packs/${encodeURIComponent(editId)}`);
        const j = (await r.json()) as { ok?: boolean; pack?: KnowledgePack; message?: string };
        if (cancelled) return;
        if (!j.ok || !j.pack) {
          setErr(j.message ?? "불러오기 실패");
          return;
        }
        fillFromPack(j.pack);
      } catch {
        if (!cancelled) setErr("네트워크 오류");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, fillFromPack]);

  const sectionsPayload = useMemo(
    () => ({
      recommendedUseCases,
      notRecommendedUseCases,
      capabilities,
      constraints,
      implementationGuidelines,
      cursorPromptRules,
      forbiddenPatterns,
      reviewChecklist,
      securityChecklist,
      alternatives,
      references,
      previewSpec,
    }),
    [
      recommendedUseCases,
      notRecommendedUseCases,
      capabilities,
      constraints,
      implementationGuidelines,
      cursorPromptRules,
      forbiddenPatterns,
      reviewChecklist,
      securityChecklist,
      alternatives,
      references,
      previewSpec,
    ]
  );

  const save = async (isPatch: boolean) => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    const agentList = agents
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const body = {
      scope,
      category,
      name,
      summary,
      description,
      vendor,
      licenseType,
      status,
      licenseNotes,
      agents: agentList.length ? agentList : ["AI_DEVELOPER"],
      sections: sectionsPayload,
      ...(isPatch ? { changeSummary: changeSummary || "수정" } : {}),
      ...(precheckResult
        ? {
            precheckSummary: {
              decision: precheckResult.decision,
              riskLevel: precheckResult.riskLevel,
              score: precheckResult.score,
            },
          }
        : {}),
    };
    try {
      const url = isPatch ? `/api/knowledge-packs/${encodeURIComponent(editId)}` : "/api/knowledge-packs";
      const r = await fetch(url, {
        method: isPatch ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { ok?: boolean; message?: string; pack?: KnowledgePack };
      if (!j.ok) {
        setErr(j.message ?? "저장 실패");
        return;
      }
      setMsg(isPatch ? "저장되었습니다. 새 버전이 생성되었습니다." : "등록되었습니다.");
      await loadDbList();
      if (!isPatch && j.pack?.id) {
        router.replace(`/knowledge-packs/manage?id=${encodeURIComponent(j.pack.id)}`);
      }
    } catch {
      setErr("네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    if (!editId.startsWith("kp_")) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/knowledge-packs/${encodeURIComponent(editId)}/activate`, { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; message?: string };
      if (!j.ok) {
        setErr(j.message ?? "활성화 실패");
        return;
      }
      setMsg("ACTIVE 로 전환되었습니다.");
      setStatus("ACTIVE");
      await loadDbList();
    } catch {
      setErr("네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  const precheckDraftHint = useMemo(() => {
    if (!precheckResult) return null;
    if (!precheckResult.canGenerateDraft) {
      return "사전점검에서 등록 비권장으로 판단되어 AI 초안 생성을 막았습니다. 제품명·문서 링크·목적을 보강한 뒤 다시 사전점검하세요.";
    }
    if (precheckResult.decision === "USER_SOURCE_REQUIRED") {
      return "사전점검: 공개 자료가 부족합니다. 초안은 생성할 수 있으나 내부 매뉴얼·API 명세를 원천자료로 추가하는 것을 권장합니다.";
    }
    if (precheckResult.decision === "LIMITED_REGISTERABLE") {
      return "사전점검: 제한 등록입니다. 라이선스·약관·보안 검토를 거친 뒤 저장하세요.";
    }
    if (precheckResult.decision === "REGISTERABLE") {
      return "사전점검: 등록 가능 판정입니다. 초안 생성 후에도 공식 문서와 대조 검증하세요.";
    }
    return null;
  }, [precheckResult]);

  const runPrecheck = async () => {
    const preInput = buildKnowledgePackPrecheckInputFromWizard({
      name,
      category: category as KnowledgePackCategory,
      agentsText: agents,
      aiProductUrl,
      aiPurpose,
      aiOfficialDocsUrl,
      aiApiDocsUrl,
      aiRepositoryUrl,
      aiLicenseHint,
      aiMemo,
    });
    if (!preInput) {
      setErr("제품명을 입력해야 사전점검을 할 수 있습니다.");
      return;
    }
    setErr(null);
    setPrecheckBusy(true);
    try {
      const res = await requestKnowledgePackPrecheckApi(preInput);
      if (res.status === 401) {
        setErr(res.json.message ?? "로그인이 필요합니다.");
        return;
      }
      if (res.status === 400 || !res.json.ok) {
        setErr(res.json.message ?? "사전점검 요청이 처리되지 않았습니다.");
        return;
      }
      if (!res.json.result) {
        setErr("사전점검 응답 형식이 올바르지 않습니다.");
        return;
      }
      setPrecheckResult(res.json.result);
      setMsg("사전점검이 완료되었습니다.");
    } catch {
      setErr("네트워크 오류");
    } finally {
      setPrecheckBusy(false);
    }
  };

  const generateDraft = async () => {
    const inputBase = buildKnowledgePackDraftInputFromWizard({
      name,
      category: category as KnowledgePackCategory,
      agentsText: agents,
      aiProductUrl,
      aiPurpose,
      aiOfficialDocsUrl,
      aiApiDocsUrl,
      aiRepositoryUrl,
      aiLicenseHint,
      aiMemo,
    });
    if (!inputBase) {
      setErr("제품명을 입력해야 AI 초안을 생성할 수 있습니다.");
      return;
    }
    const input =
      precheckResult && precheckResult.canGenerateDraft
        ? {
            ...inputBase,
            precheckDecision: precheckResult.decision,
            precheckRiskLevel: precheckResult.riskLevel,
            precheckIssueSummaries: precheckResult.issues.map((i) => `${i.title}: ${i.description}`),
            precheckRequiresSecurityReview: precheckResult.shouldRequireSecurityReview,
            precheckRequiresLicenseReview: precheckResult.shouldRequireLicenseReview,
            precheckRequiresUserProvidedDocs: precheckResult.shouldRequireUserProvidedDocs,
          }
        : inputBase;
    setErr(null);
    setDraftGenerating(true);

    const applyLocal = (draft: KnowledgePackDraftResult) => {
      applyKnowledgePackDraftResult(draft, {
        setSummary,
        setLicenseNotes,
        setRecommendedUseCases,
        setNotRecommendedUseCases,
        setCapabilities,
        setConstraints,
        setImplementationGuidelines,
        setCursorPromptRules,
        setForbiddenPatterns,
        setReviewChecklist,
        setSecurityChecklist,
        setAlternatives,
        setReferences,
        setPreviewSpec,
      });
      setLastSourceCandidates(draft.sourceCandidates);
      setLastDraftWarnings(draft.warnings);
      setStatus("DRAFT");
      const inferred = inferLicenseTypeFromHint(aiLicenseHint);
      if (inferred) setLicenseType(inferred);
      const descLines: string[] = [];
      if (aiPurpose.trim()) descLines.push(`사용 목적: ${aiPurpose.trim()}`);
      if (aiProductUrl.trim()) descLines.push(`제품 URL: ${aiProductUrl.trim()}`);
      if (descLines.length) setDescription(descLines.join("\n"));
    };

    try {
      const api = await requestKnowledgePackDraftApi(input);
      const out = interpretKnowledgePackDraftApiResponse(input, api);
      if (out.kind === "error") {
        setErr(out.message);
        return;
      }
      applyLocal(out.draft);
      setMsg(out.message);
    } catch {
      applyLocal(generateKnowledgePackDraftMock(input));
      setMsg(knowledgePackDraftClientMessages.networkFallback);
    } finally {
      setDraftGenerating(false);
    }
  };

  const isEdit = editId.startsWith("kp_");

  return (
    <div
      style={{
        boxSizing: "border-box",
        flex: 1,
        minHeight: 0,
        width: "100%",
        maxWidth: 920,
        margin: "0 auto",
        maxHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          padding: "16px 14px max(24px, env(safe-area-inset-bottom, 12px))",
          boxSizing: "border-box",
        }}
      >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, flex: "1 1 auto" }}>지식팩 등록·수정</h1>
        <Link href="/knowledge-packs" prefetch={false} style={{ fontSize: 13, fontWeight: 700, color: t.accentTealFg }}>
          ← 목록
        </Link>
      </div>

      <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.55, margin: "0 0 12px" }}>
        최소 정보를 입력한 뒤 「AI로 지식팩 초안 생성」은 서버에서 LLM을 시도하고, 키가 없거나 실패하면 Mock으로 채웁니다. DB 지식팩 편집 시 아래에서 원천자료 수집·청크(1단계)와 키워드 검색을 사용할 수 있습니다. 저장 시 새 버전이 생성됩니다(수정 시). 플랫폼 기본 지식팩은 목록에서만 읽을 수 있습니다.
      </p>

      {err ? (
        <div style={{ padding: 10, borderRadius: 8, background: "#fef2f2", color: "#b91c1c", marginBottom: 12, fontSize: 13 }}>{err}</div>
      ) : null}
      {msg ? (
        <div style={{ padding: 10, borderRadius: 8, background: "#ecfdf5", color: t.accentTealFg, marginBottom: 12, fontSize: 13 }}>{msg}</div>
      ) : null}

      <div style={{ marginBottom: 14, padding: 12, border: `1px solid ${t.border}`, borderRadius: t.radiusMd, background: "#f8fafc" }}>
        <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 8, color: t.textSecondary }}>내 DB 지식팩</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
          {dbPacks.length === 0 ? (
            <span style={{ fontSize: 13, color: t.textMuted }}>등록된 항목이 없습니다.</span>
          ) : (
            dbPacks.map((p) => (
              <Link
                key={p.id}
                href={`/knowledge-packs/manage?id=${encodeURIComponent(p.id)}`}
                prefetch={false}
                style={{ fontSize: 13, fontWeight: 700, color: p.id === editId ? t.accentTeal : t.info }}
              >
                {p.name} <span style={{ fontWeight: 600, color: t.textMuted }}>({p.status})</span>
              </Link>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            resetEmpty();
            router.replace("/knowledge-packs/manage");
            setMsg(null);
            setErr(null);
          }}
          style={{ marginTop: 10, padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
        >
          신규 등록 폼
        </button>
      </div>

      {loading ? <div style={{ marginBottom: 12, fontSize: 13, color: t.textMuted }}>불러오는 중…</div> : null}

      <Section title="AI 초안 · 최소 입력">
        <KnowledgePacksManageAiDraftSection
          inputStyle={fieldStyle()}
          draftBusy={draftGenerating}
          categories={CATEGORIES}
          name={name}
          onNameChange={setName}
          aiProductUrl={aiProductUrl}
          onAiProductUrlChange={setAiProductUrl}
          category={category}
          onCategoryChange={setCategory}
          agents={agents}
          onAgentsChange={setAgents}
          aiPurpose={aiPurpose}
          onAiPurposeChange={setAiPurpose}
          aiOfficialDocsUrl={aiOfficialDocsUrl}
          onAiOfficialDocsUrlChange={setAiOfficialDocsUrl}
          aiApiDocsUrl={aiApiDocsUrl}
          onAiApiDocsUrlChange={setAiApiDocsUrl}
          aiRepositoryUrl={aiRepositoryUrl}
          onAiRepositoryUrlChange={setAiRepositoryUrl}
          aiLicenseHint={aiLicenseHint}
          onAiLicenseHintChange={setAiLicenseHint}
          aiMemo={aiMemo}
          onAiMemoChange={setAiMemo}
          onGenerateDraft={generateDraft}
          onRunPrecheck={runPrecheck}
          precheckBusy={precheckBusy}
          precheckResult={precheckResult}
          draftBlockedByPrecheck={precheckResult != null && !precheckResult.canGenerateDraft}
          precheckDraftHint={precheckDraftHint}
          lastDraftWarnings={lastDraftWarnings}
          lastSourceCandidates={lastSourceCandidates}
        />
      </Section>

      <Section title="기본 정보">
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          Scope
          <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ ...fieldStyle(), marginTop: 4 }}>
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="ORGANIZATION" disabled>
              ORGANIZATION (준비중)
            </option>
          </select>
        </label>
        <label style={{ display: "block", marginTop: 10, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          벤더
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} style={{ ...fieldStyle(), marginTop: 4 }} />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
          <label style={{ flex: "1 1 160px", fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
            라이선스 유형
            <select value={licenseType} onChange={(e) => setLicenseType(e.target.value)} style={{ ...fieldStyle(), marginTop: 4 }}>
              {LICENSES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: "1 1 160px", fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
            상태
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...fieldStyle(), marginTop: 4 }}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        {status === "ACTIVE" ? (
          <div
            style={{
              marginTop: 10,
              padding: 8,
              borderRadius: 8,
              background: "#fefce8",
              border: `1px solid #fde047`,
              fontSize: 12,
              color: "#713f12",
            }}
          >
            ACTIVE로 저장하면 즉시 병합 후보에 반영될 수 있습니다. AI 초안·검수 전에는 DRAFT 저장을 권장합니다.
          </div>
        ) : null}
        <label style={{ display: "block", marginTop: 10, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          요약
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} style={{ ...fieldStyle(), marginTop: 4, resize: "vertical" }} />
        </label>
        <label style={{ display: "block", marginTop: 10, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          설명
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...fieldStyle(), marginTop: 4, resize: "vertical" }} />
        </label>
        <label style={{ display: "block", marginTop: 10, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          라이선스 메모 (줄바꿈)
          <textarea value={licenseNotes} onChange={(e) => setLicenseNotes(e.target.value)} rows={3} style={{ ...fieldStyle(), marginTop: 4, resize: "vertical" }} />
        </label>
        {isEdit ? (
          <label style={{ display: "block", marginTop: 10, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
            변경 요약 (새 버전 설명)
            <input value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} style={{ ...fieldStyle(), marginTop: 4 }} />
          </label>
        ) : null}
      </Section>

      <Section title="상세 섹션 (줄바꿈 = 항목)">
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>적용 권장</label>
        <textarea value={recommendedUseCases} onChange={(e) => setRecommendedUseCases(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>적용 비권장</label>
        <textarea value={notRecommendedUseCases} onChange={(e) => setNotRecommendedUseCases(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>주요 기능</label>
        <textarea value={capabilities} onChange={(e) => setCapabilities(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>제약 (라이선스 메모와 별도)</label>
        <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>구현 지침</label>
        <textarea value={implementationGuidelines} onChange={(e) => setImplementationGuidelines(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>Cursor 반영</label>
        <textarea value={cursorPromptRules} onChange={(e) => setCursorPromptRules(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>금지사항</label>
        <textarea value={forbiddenPatterns} onChange={(e) => setForbiddenPatterns(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>검수 체크리스트</label>
        <textarea value={reviewChecklist} onChange={(e) => setReviewChecklist(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>보안 체크리스트</label>
        <textarea value={securityChecklist} onChange={(e) => setSecurityChecklist(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>대체/비교</label>
        <textarea value={alternatives} onChange={(e) => setAlternatives(e.target.value)} rows={3} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>
          참고 링크 (`라벨 | URL` 줄 단위)
        </label>
        <textarea value={references} onChange={(e) => setReferences(e.target.value)} rows={4} style={{ ...fieldStyle(), resize: "vertical", marginBottom: 10 }} />
        <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800 }}>미리보기 정의 (선택)</label>
        <textarea value={previewSpec} onChange={(e) => setPreviewSpec(e.target.value)} rows={3} style={{ ...fieldStyle(), resize: "vertical" }} />
      </Section>

      {isEdit ? (
        <Section title="원천자료 / RAG 색인 (1단계)">
          <KnowledgePackSourceManager
            knowledgePackId={editId}
            referencesText={references}
            onNotify={(kind, m) => {
              if (kind === "ok") {
                setMsg(m);
                setErr(null);
              } else {
                setErr(m);
                setMsg(null);
              }
            }}
          />
        </Section>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => void save(isEdit)}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: t.accentTeal,
            color: "#fff",
            fontWeight: 800,
            cursor: saving ? "wait" : "pointer",
            fontSize: 14,
          }}
        >
          {isEdit ? "저장 (새 버전)" : "등록"}
        </button>
        {isEdit ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void activate()}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            활성화 (ACTIVE)
          </button>
        ) : null}
      </div>
      </div>
    </div>
  );
}
