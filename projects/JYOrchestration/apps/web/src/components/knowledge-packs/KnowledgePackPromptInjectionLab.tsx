"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

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

export type KnowledgePackPromptInjectionLabProps = Readonly<{
  onNotify: (kind: "ok" | "err", message: string) => void;
  /** 작업 설명이 비어 있을 때 추천·병합 쿼리로 사용(예: RAG 검색어) */
  queryFallback?: string;
  /** `POST /api/knowledge-packs/recommend`에 선택 전달 */
  projectId?: string;
  /** 추천 시 카테고리 힌트(예: 편집 중 지식팩 카테고리) */
  categoryHints?: readonly string[];
}>;

type InjectRecRow = Readonly<{
  knowledgePackId: string;
  name: string;
  category: string;
  score: number;
  reasons: string[];
  source: string;
}>;

/**
 * 지식팩 룰 추천 + 병합 프롬프트 컨텍스트 미리보기(관리·검증용).
 */
export function KnowledgePackPromptInjectionLab(props: KnowledgePackPromptInjectionLabProps) {
  const { onNotify, queryFallback = "", projectId, categoryHints } = props;
  const [injectTaskText, setInjectTaskText] = useState("");
  const [injectRecs, setInjectRecs] = useState<InjectRecRow[]>([]);
  const [injectSelected, setInjectSelected] = useState<Record<string, boolean>>({});
  const [injectLabPreview, setInjectLabPreview] = useState<{ text: string; diagnostics: string[] } | null>(null);
  const [injectBusy, setInjectBusy] = useState<string | null>(null);

  const effectiveQuery = () => (injectTaskText.trim() || String(queryFallback ?? "").trim()).trim();

  const runInjectRecommend = async () => {
    const text = effectiveQuery();
    if (!text) {
      onNotify("err", "작업 설명을 입력하거나, RAG 검색어 등 보조 입력을 제공하세요.");
      return;
    }
    setInjectBusy("injectRec");
    setInjectLabPreview(null);
    try {
      const body: Record<string, unknown> = { text, agentRole: "AI_DEVELOPER", limit: 8 };
      const pid = String(projectId ?? "").trim();
      if (pid) body.projectId = pid;
      const hints = (categoryHints ?? []).map((h) => String(h ?? "").trim()).filter(Boolean);
      if (hints.length) body.categoryHints = hints;

      const r = await fetch("/api/knowledge-packs/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        recommendations?: InjectRecRow[];
        message?: string;
      };
      if (!j.ok || !Array.isArray(j.recommendations)) {
        onNotify("err", j.message ?? "추천 실패");
        setInjectRecs([]);
        setInjectSelected({});
        return;
      }
      setInjectRecs(j.recommendations);
      const sel: Record<string, boolean> = {};
      for (const row of j.recommendations) sel[row.knowledgePackId] = true;
      setInjectSelected(sel);
      onNotify("ok", `추천 ${j.recommendations.length}건`);
    } catch {
      onNotify("err", "네트워크 오류");
    } finally {
      setInjectBusy(null);
    }
  };

  const runInjectBuildContext = async () => {
    const text = effectiveQuery();
    if (!text) {
      onNotify("err", "작업 설명을 입력하거나, 보조 검색어를 제공하세요.");
      return;
    }
    const ids = injectRecs.map((r) => r.knowledgePackId).filter((id) => injectSelected[id]);
    if (!ids.length) {
      onNotify("err", "선택된 지식팩이 없습니다.");
      return;
    }
    setInjectBusy("injectCtx");
    try {
      const r = await fetch("/api/knowledge-packs/build-prompt-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgePackIds: ids,
          query: text.slice(0, 4000),
          taskTitle: "관리 UI 미리보기",
          taskDescription: injectTaskText.trim() || undefined,
          agentRole: "AI_DEVELOPER",
          limit: 5,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; contextText?: string; diagnostics?: string[]; message?: string };
      if (!j.ok || typeof j.contextText !== "string") {
        onNotify("err", j.message ?? "컨텍스트 생성 실패");
        setInjectLabPreview(null);
        return;
      }
      setInjectLabPreview({
        text: j.contextText,
        diagnostics: Array.isArray(j.diagnostics) ? j.diagnostics.map(String) : [],
      });
      onNotify("ok", "병합 프롬프트 컨텍스트를 생성했습니다.");
    } catch {
      onNotify("err", "네트워크 오류");
      setInjectLabPreview(null);
    } finally {
      setInjectBusy(null);
    }
  };

  return (
    <div style={{ marginTop: 0, padding: 10, border: `1px solid ${t.border}`, borderRadius: t.radiusMd, background: "#fafafa" }}>
      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>AI개발자 프롬프트 주입 미리보기</div>
      <p style={{ fontSize: 11, color: t.textMuted, margin: "0 0 8px", lineHeight: 1.45 }}>
        요구·작업 설명으로 룰 기반 추천을 받고, 선택한 지식팩을 병합한 `contextText`를 확인합니다. 자동 실행 파이프라인과 별개입니다.
      </p>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSecondary, marginBottom: 8 }}>
        {queryFallback.trim() ? "작업 설명 (비우면 아래 RAG 검색어 등 보조 입력 사용)" : "작업 설명"}
        <textarea
          value={injectTaskText}
          onChange={(e) => setInjectTaskText(e.target.value)}
          rows={3}
          style={{ ...fieldStyle(), marginTop: 4, resize: "vertical" }}
        />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          disabled={injectBusy === "injectRec"}
          onClick={() => void runInjectRecommend()}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            fontWeight: 800,
            fontSize: 12,
            cursor: injectBusy === "injectRec" ? "wait" : "pointer",
          }}
        >
          관련 지식팩 추천
        </button>
        <button
          type="button"
          disabled={injectBusy === "injectCtx" || !injectRecs.length}
          onClick={() => void runInjectBuildContext()}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: t.accentTeal,
            color: "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: injectBusy === "injectCtx" ? "wait" : "pointer",
          }}
        >
          프롬프트 컨텍스트 생성(병합)
        </button>
      </div>
      {injectRecs.length ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 6 }}>추천 목록</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {injectRecs.map((row) => (
              <label
                key={row.knowledgePackId}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  fontSize: 11,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  padding: 8,
                  background: "#fff",
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(injectSelected[row.knowledgePackId])}
                  onChange={(e) => setInjectSelected((prev) => ({ ...prev, [row.knowledgePackId]: e.target.checked }))}
                  style={{ marginTop: 2 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>
                    {row.name}{" "}
                    <span style={{ color: t.textMuted, fontWeight: 600 }}>
                      ({row.knowledgePackId}) · {row.category} · {row.source} · score {row.score}
                    </span>
                  </div>
                  {row.reasons?.length ? (
                    <div style={{ color: t.textSecondary, marginTop: 4, lineHeight: 1.45 }}>
                      {row.reasons.join(" · ")}
                    </div>
                  ) : null}
                </div>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {injectLabPreview ? (
        <>
          <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 6 }}>
            <span style={{ fontWeight: 800 }}>diagnostics</span> {injectLabPreview.diagnostics.join(" · ") || "—"}
          </div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSecondary }}>
            병합 contextText (읽기 전용)
            <textarea
              readOnly
              value={injectLabPreview.text}
              rows={14}
              style={{ ...fieldStyle(), marginTop: 4, fontFamily: "ui-monospace, monospace", fontSize: 11, lineHeight: 1.45 }}
            />
          </label>
        </>
      ) : (
        <div style={{ fontSize: 11, color: t.textMuted }}>추천 후 병합 생성하면 이곳에 표시됩니다.</div>
      )}
    </div>
  );
}
