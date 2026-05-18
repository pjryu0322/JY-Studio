"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { PlatformAiCapability, PlatformAiMember } from "@/lib/ai/platformAiMembers";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { MEDIA_QUERY } from "@/components/ui/breakpoints";
import { useMediaQuery } from "@/components/ui/useMediaQuery";

const OPENAI_MODELS = ["GPT-5", "GPT-4.1", "o3"] as const;
const CURSOR_MODELS = ["cursor-default"] as const;

const ENGINE_OPENAI = "OpenAI" as const;
const ENGINE_CURSOR = "Cursor" as const;

function normalizeEngineModel(input: Pick<PlatformAiMember, "defaultEngine" | "defaultModel">): {
  defaultEngine: string;
  defaultModel: string | undefined;
} {
  const engine = String(input.defaultEngine ?? "").trim();
  const model = input.defaultModel === undefined || input.defaultModel === null ? "" : String(input.defaultModel).trim();
  if (engine === ENGINE_OPENAI) return { defaultEngine: ENGINE_OPENAI, defaultModel: model || "GPT-5" };
  if (engine === ENGINE_CURSOR) return { defaultEngine: ENGINE_CURSOR, defaultModel: model || "cursor-default" };
  return { defaultEngine: engine, defaultModel: model || undefined };
}

function allowedEnginesForMember(memberId: string): readonly string[] {
  return memberId === "prototype_build" ? [ENGINE_CURSOR, ENGINE_OPENAI] : [ENGINE_OPENAI];
}

function allowedModelsForEngine(engine: string): readonly string[] {
  if (engine === ENGINE_OPENAI) return OPENAI_MODELS;
  if (engine === ENGINE_CURSOR) return CURSOR_MODELS;
  return [];
}

function engineHelp(engine: string): string {
  if (engine === ENGINE_OPENAI) return "OpenAI: 기획/분석/설계/검수 중심 AI 엔진";
  if (engine === ENGINE_CURSOR) return "Cursor: 실제 프로토타입 소스 생성/커밋/푸시 실행 엔진";
  return "";
}

export function PlatformAiMemberDetailClient({ aiMemberId }: { readonly aiMemberId: string }) {
  const isNarrow = useMediaQuery(MEDIA_QUERY.workflowNavNarrow);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [draft, setDraft] = useState<PlatformAiMember | null>(null);
  const [policyText, setPolicyText] = useState("{}");

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await credentialsIncludeFetch(`/api/admin/platform-ai-members/${encodeURIComponent(aiMemberId)}`);
      const json = (await res.json()) as { success?: boolean; data?: { member?: PlatformAiMember }; message?: string };
      if (res.status === 403) {
        setAllowed(false);
        setDraft(null);
        return;
      }
      if (res.status === 404 || !json.success || !json.data?.member) {
        setAllowed(true);
        setDraft(null);
        setBanner({ tone: "err", text: json.message || "불러오지 못했습니다." });
        return;
      }
      setAllowed(true);
      const normalized = normalizeEngineModel(json.data.member);
      setDraft({ ...json.data.member, ...normalized });
      setPolicyText(JSON.stringify(json.data.member.policy ?? {}, null, 2));
    } catch {
      setAllowed(false);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, [aiMemberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = useCallback(async () => {
    if (!draft) return;
    let policy: Record<string, unknown>;
    try {
      policy = JSON.parse(policyText) as Record<string, unknown>;
      if (!policy || typeof policy !== "object" || Array.isArray(policy)) throw new Error("policy");
    } catch {
      setBanner({ tone: "err", text: "정책(JSON) 형식이 올바르지 않습니다." });
      return;
    }
    const normalized = normalizeEngineModel(draft);
    const payload: PlatformAiMember = { ...draft, ...normalized, policy };

    // validation (요구사항)
    if (payload.id !== "prototype_build" && payload.defaultEngine === ENGINE_CURSOR) {
      setBanner({ tone: "err", text: "Cursor는 AI 개발자(프로토타입 제작)에서만 사용할 수 있습니다." });
      return;
    }
    if (payload.defaultEngine === ENGINE_OPENAI && (!payload.defaultModel || !OPENAI_MODELS.includes(payload.defaultModel as never))) {
      setBanner({ tone: "err", text: "OpenAI 모델 선택이 올바르지 않습니다." });
      return;
    }
    if (payload.defaultEngine === ENGINE_CURSOR && payload.defaultModel !== "cursor-default") {
      setBanner({ tone: "err", text: "Cursor 모델 선택이 올바르지 않습니다." });
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      const res = await credentialsIncludeFetch(`/api/admin/platform-ai-members/${encodeURIComponent(aiMemberId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; message?: string; data?: { member?: PlatformAiMember } };
      if (res.status === 403) {
        setBanner({ tone: "err", text: "저장 권한이 없습니다." });
        return;
      }
      if (!res.ok || !json.success) {
        setBanner({ tone: "err", text: json.message || "저장에 실패했습니다." });
        return;
      }
      if (json.data?.member) {
        setDraft(json.data.member);
        setPolicyText(JSON.stringify(json.data.member.policy ?? {}, null, 2));
      }
      setBanner({ tone: "ok", text: json.message || "저장했습니다." });
    } catch {
      setBanner({ tone: "err", text: "네트워크 오류로 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  }, [draft, policyText, aiMemberId]);

  const ta = (opts: { minHeight: number }): CSSProperties => ({
    width: "100%",
    minHeight: opts.minHeight,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    lineHeight: 1.5,
    resize: "vertical" as const,
    fontFamily: "inherit",
  });

  if (allowed === false && !loading) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>접근 제한</h1>
        <p style={{ color: "#b91c1c", marginTop: 12 }}>플랫폼 관리자만 편집할 수 있습니다.</p>
        <Link href="/settings/ai-members" style={{ color: "#2563eb", fontWeight: 800 }}>
          목록으로
        </Link>
      </div>
    );
  }

  if (loading || !draft) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px" }}>
        <p style={{ color: "#64748b" }}>{loading ? "불러오는 중…" : "항목을 찾을 수 없습니다."}</p>
        <Link href="/settings/ai-members" style={{ color: "#2563eb", fontWeight: 800 }}>
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: isNarrow ? "12px 12px 40px" : "20px 16px 48px" }}>
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <Link href="/settings/ai-members" style={{ fontSize: 13, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}>
          ← 목록
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px", fontSize: isNarrow ? 18 : 22, fontWeight: 900, color: "#0f172a" }}>{draft.name}</h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>id: {draft.id}</p>

      {banner ? (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            background: banner.tone === "ok" ? "#f0fdf4" : "#fef2f2",
            border: banner.tone === "ok" ? "1px solid #86efac" : "1px solid #fecaca",
            color: banner.tone === "ok" ? "#14532d" : "#b91c1c",
          }}
        >
          {banner.text}
        </div>
      ) : null}

      <h2 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: "24px 0 12px" }}>기본 정보</h2>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>이름</span>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          style={{ ...ta({ minHeight: 44 }), fontSize: 16 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>역할</span>
        <input
          value={draft.role}
          onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          style={{ ...ta({ minHeight: 44 }), fontSize: 16 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Capability</span>
        <select
          value={draft.capability}
          onChange={(e) => setDraft({ ...draft, capability: e.target.value as PlatformAiCapability })}
          style={{ ...ta({ minHeight: 44 }), fontSize: 16 }}
        >
          <option value="LLM">LLM</option>
          <option value="CODE">CODE</option>
          <option value="SECURITY">SECURITY</option>
        </select>
      </label>

      <h2 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: "24px 0 12px" }}>페르소나</h2>
      <textarea
        value={draft.persona}
        onChange={(e) => setDraft({ ...draft, persona: e.target.value })}
        style={ta({ minHeight: 100 })}
      />

      <h2 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: "24px 0 12px" }}>행동 규칙</h2>
      <textarea
        value={draft.behaviorRules}
        onChange={(e) => setDraft({ ...draft, behaviorRules: e.target.value })}
        style={ta({ minHeight: 100 })}
      />

      <h2 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: "24px 0 12px" }}>Platform Knowledge</h2>
      <textarea
        value={draft.knowledge}
        onChange={(e) => setDraft({ ...draft, knowledge: e.target.value })}
        style={ta({ minHeight: 100 })}
      />

      <h2 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: "24px 0 12px" }}>정책 (JSON)</h2>
      <textarea value={policyText} onChange={(e) => setPolicyText(e.target.value)} style={{ ...ta({ minHeight: 120 }), fontFamily: "ui-monospace, monospace", fontSize: 13 }} />

      <h2 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: "24px 0 12px" }}>기본 엔진</h2>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
        {engineHelp(draft.defaultEngine)}
      </p>
      <select
        value={draft.defaultEngine}
        onChange={(e) => {
          const nextEngine = e.target.value;
          const next = normalizeEngineModel({ defaultEngine: nextEngine, defaultModel: draft.defaultModel });
          // 엔진이 바뀌면 모델은 해당 엔진 기본값으로 자동 보정
          const models = allowedModelsForEngine(next.defaultEngine);
          const modelOk = next.defaultModel && models.includes(next.defaultModel as never);
          setDraft({ ...draft, defaultEngine: next.defaultEngine, defaultModel: modelOk ? next.defaultModel : models[0] });
        }}
        style={{ ...ta({ minHeight: 44 }), fontSize: 16 }}
      >
        {allowedEnginesForMember(draft.id).map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>

      <h2 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: "18px 0 12px" }}>기본 모델</h2>
      <select
        value={String(draft.defaultModel ?? "")}
        onChange={(e) => setDraft({ ...draft, defaultModel: e.target.value })}
        style={{ ...ta({ minHeight: 44 }), fontSize: 16 }}
      >
        {allowedModelsForEngine(draft.defaultEngine).map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 28 }}>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            background: saving ? "#94a3b8" : "#0d9488",
            color: "#fff",
            fontWeight: 900,
            fontSize: 15,
            cursor: saving ? "wait" : "pointer",
            minHeight: 44,
          }}
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
