"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { parseReferences } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { inferSourceTypeFromReference } from "@/lib/knowledge-packs/knowledgePackSources";
import type {
  KnowledgePackRetrieveContextApiErr,
  KnowledgePackRetrieveContextApiOk,
} from "@/lib/knowledge-packs/knowledgePackRetrieveContextApiTypes";

type ListedSource = Readonly<{
  id: string;
  isVirtual?: boolean;
  sourceType: string;
  title: string;
  url?: string | null;
  status: string;
  ragEnabled: boolean;
  chunkCount: number;
  lastError?: string | null;
}>;

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

export function KnowledgePackSourceManager(props: Readonly<{
  knowledgePackId: string;
  referencesText: string;
  onNotify: (kind: "ok" | "err", message: string) => void;
}>) {
  const { knowledgePackId, referencesText, onNotify } = props;
  const [sources, setSources] = useState<ListedSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [newType, setNewType] = useState("URL");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newRaw, setNewRaw] = useState("");
  const [retrieveQuery, setRetrieveQuery] = useState("");
  const [retrieveResult, setRetrieveResult] = useState<KnowledgePackRetrieveContextApiOk | KnowledgePackRetrieveContextApiErr | null>(null);
  const [promptContextPreview, setPromptContextPreview] = useState<{ text: string; diagnostics: string[] } | null>(null);
  const [injectTaskText, setInjectTaskText] = useState("");
  const [injectRecs, setInjectRecs] = useState<
    Array<{ knowledgePackId: string; name: string; category: string; score: number; reasons: string[]; source: string }>
  >([]);
  const [injectSelected, setInjectSelected] = useState<Record<string, boolean>>({});
  const [injectLabPreview, setInjectLabPreview] = useState<{ text: string; diagnostics: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/knowledge-packs/${encodeURIComponent(knowledgePackId)}/sources`);
      const j = (await r.json()) as { ok?: boolean; sources?: ListedSource[] };
      if (j.ok && Array.isArray(j.sources)) setSources(j.sources);
      else setSources([]);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [knowledgePackId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addSource = async () => {
    setBusy("add");
    try {
      const r = await fetch(`/api/knowledge-packs/${encodeURIComponent(knowledgePackId)}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: newType,
          title: newTitle || "Untitled",
          url: newUrl || undefined,
          rawText: newRaw || undefined,
          ragEnabled: true,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; message?: string };
      if (!j.ok) {
        onNotify("err", j.message ?? "등록 실패");
        return;
      }
      onNotify("ok", "원천자료가 등록되었습니다.");
      setNewTitle("");
      setNewUrl("");
      setNewRaw("");
      await load();
    } catch {
      onNotify("err", "네트워크 오류");
    } finally {
      setBusy(null);
    }
  };

  const importFromReferences = async () => {
    const refs = parseReferences(referencesText);
    if (!refs.length) {
      onNotify("err", "참고 링크 필드에 `라벨 | URL` 형식으로 한 줄 이상 입력하세요.");
      return;
    }
    const existing = new Set(
      sources.map((s) => (s.url ?? "").trim()).filter(Boolean)
    );
    setBusy("import");
    let added = 0;
    try {
      for (const ref of refs) {
        const u = ref.url.trim();
        if (!u || existing.has(u)) continue;
        const sourceType = inferSourceTypeFromReference(ref.label, ref.url);
        const r = await fetch(`/api/knowledge-packs/${encodeURIComponent(knowledgePackId)}/sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType,
            title: ref.label.trim() || u,
            url: u,
            ragEnabled: true,
          }),
        });
        const j = (await r.json()) as { ok?: boolean };
        if (j.ok) {
          added += 1;
          existing.add(u);
        }
      }
      onNotify("ok", added ? `${added}건을 원천자료로 추가했습니다.` : "추가할 새 링크가 없습니다(이미 등록됨).");
      await load();
    } catch {
      onNotify("err", "네트워크 오류");
    } finally {
      setBusy(null);
    }
  };

  const collect = async (sourceId: string, opts?: Readonly<{ rechunkOnly?: boolean; collectOnly?: boolean }>) => {
    setBusy(sourceId);
    try {
      const r = await fetch(`/api/knowledge-packs/sources/${encodeURIComponent(sourceId)}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rechunkOnly: opts?.rechunkOnly,
          chunk: opts?.collectOnly ? false : true,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; message?: string; chunkCount?: number; plainLength?: number };
      if (!j.ok) {
        onNotify("err", j.message ?? "실패");
        return;
      }
      onNotify(
        "ok",
        opts?.rechunkOnly
          ? `청크 저장 완료 (${j.chunkCount ?? 0}개)`
          : opts?.collectOnly
            ? `수집 완료 (${j.plainLength ?? 0}자)`
            : `수집·청크 완료 (${j.chunkCount ?? 0}개 청크)`
      );
      await load();
    } catch {
      onNotify("err", "네트워크 오류");
    } finally {
      setBusy(null);
    }
  };

  const disable = async (sourceId: string) => {
    if (!window.confirm("이 원천자료를 비활성화할까요?")) return;
    setBusy(sourceId);
    try {
      const r = await fetch(`/api/knowledge-packs/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
      const j = (await r.json()) as { ok?: boolean; message?: string };
      if (!j.ok) {
        onNotify("err", j.message ?? "실패");
        return;
      }
      onNotify("ok", "비활성화했습니다.");
      await load();
    } catch {
      onNotify("err", "네트워크 오류");
    } finally {
      setBusy(null);
    }
  };

  const tryRetrieve = async () => {
    const q = retrieveQuery.trim();
    if (!q) return;
    setBusy("retrieve");
    try {
      const r = await fetch("/api/knowledge-packs/retrieve-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgePackId, query: q, limit: 8 }),
      });
      const j = (await r.json()) as KnowledgePackRetrieveContextApiOk | KnowledgePackRetrieveContextApiErr | { ok?: boolean; message?: string };
      if (!j || j.ok !== true) {
        const msg = "message" in j && typeof j.message === "string" ? j.message : "검색 실패";
        setRetrieveResult({ ok: false, message: msg });
        return;
      }
      setRetrieveResult(j as KnowledgePackRetrieveContextApiOk);
    } catch {
      setRetrieveResult({ ok: false, message: "네트워크 오류" });
    } finally {
      setBusy(null);
    }
  };

  const buildPromptContextPreview = async () => {
    const q = retrieveQuery.trim();
    if (!q) {
      onNotify("err", "프롬프트 미리보기에 사용할 검색어를 입력하세요.");
      return;
    }
    setBusy("promptContext");
    try {
      const r = await fetch("/api/knowledge-packs/build-prompt-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgePackId,
          query: q,
          taskTitle: "",
          taskDescription: "",
          limit: 5,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; contextText?: string; diagnostics?: string[]; message?: string };
      if (!j.ok || typeof j.contextText !== "string") {
        onNotify("err", j.message ?? "프롬프트 컨텍스트 생성 실패");
        setPromptContextPreview(null);
        return;
      }
      setPromptContextPreview({
        text: j.contextText,
        diagnostics: Array.isArray(j.diagnostics) ? j.diagnostics.map(String) : [],
      });
      onNotify("ok", "프롬프트 컨텍스트 미리보기를 갱신했습니다.");
    } catch {
      onNotify("err", "네트워크 오류");
      setPromptContextPreview(null);
    } finally {
      setBusy(null);
    }
  };

  const runInjectRecommend = async () => {
    const text = (injectTaskText.trim() || retrieveQuery.trim()).trim();
    if (!text) {
      onNotify("err", "작업 설명 또는 위 검색어를 입력하세요.");
      return;
    }
    setBusy("injectRec");
    setInjectLabPreview(null);
    try {
      const r = await fetch("/api/knowledge-packs/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, agentRole: "AI_DEVELOPER", limit: 8 }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        recommendations?: Array<{
          knowledgePackId: string;
          name: string;
          category: string;
          score: number;
          reasons: string[];
          source: string;
        }>;
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
      setBusy(null);
    }
  };

  const runInjectBuildContext = async () => {
    const text = (injectTaskText.trim() || retrieveQuery.trim()).trim();
    if (!text) {
      onNotify("err", "작업 설명 또는 위 검색어를 입력하세요.");
      return;
    }
    const ids = injectRecs.map((r) => r.knowledgePackId).filter((id) => injectSelected[id]);
    if (!ids.length) {
      onNotify("err", "선택된 지식팩이 없습니다.");
      return;
    }
    setBusy("injectCtx");
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
      setBusy(null);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, margin: "0 0 10px" }}>
        RAG 1단계: 원천자료 링크/본문 등록, 수집, 평문 파싱, 청크 분할·저장, KEYWORD 검색까지 지원합니다. 임베딩·벡터 저장소·Agent 자동 프롬프트 주입은 다음 단계입니다.
      </p>
      {loading ? <div style={{ fontSize: 12, color: t.textMuted }}>원천자료 불러오는 중…</div> : null}

      <div style={{ marginBottom: 12, padding: 10, border: `1px solid ${t.border}`, borderRadius: t.radiusMd, background: "#fafafa" }}>
        <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>원천자료 추가</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <label style={{ flex: "1 1 120px", fontSize: 11, fontWeight: 700, color: t.textSecondary }}>
            유형
            <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ ...fieldStyle(), marginTop: 4 }}>
              <option value="URL">URL</option>
              <option value="MARKDOWN">MARKDOWN</option>
              <option value="TEXT">TEXT</option>
              <option value="OPENAPI">OPENAPI</option>
              <option value="API_REFERENCE">API_REFERENCE</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </label>
          <label style={{ flex: "2 1 180px", fontSize: 11, fontWeight: 700, color: t.textSecondary }}>
            제목
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ ...fieldStyle(), marginTop: 4 }} />
          </label>
        </div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSecondary, marginBottom: 8 }}>
          URL (URL·API_REFERENCE·OpenAPI URL)
          <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} style={{ ...fieldStyle(), marginTop: 4 }} />
        </label>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSecondary }}>
          본문 rawText (TEXT·MARKDOWN·OpenAPI JSON 본문 등)
          <textarea value={newRaw} onChange={(e) => setNewRaw(e.target.value)} rows={3} style={{ ...fieldStyle(), marginTop: 4, resize: "vertical" }} />
        </label>
        <button
          type="button"
          disabled={busy === "add"}
          onClick={() => void addSource()}
          style={{
            marginTop: 10,
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: t.accentTeal,
            color: "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: busy === "add" ? "wait" : "pointer",
          }}
        >
          등록
        </button>
        <button
          type="button"
          disabled={busy === "import"}
          onClick={() => void importFromReferences()}
          style={{
            marginTop: 10,
            marginLeft: 8,
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: busy === "import" ? "wait" : "pointer",
          }}
        >
          참고 링크를 원천자료 후보로 불러오기
        </button>
      </div>

      <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radiusMd }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              <th style={{ padding: 8 }}>제목</th>
              <th style={{ padding: 8 }}>유형</th>
              <th style={{ padding: 8 }}>상태</th>
              <th style={{ padding: 8 }}>청크</th>
              <th style={{ padding: 8 }}>동작</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} style={{ borderTop: `1px solid ${t.border}` }}>
                <td style={{ padding: 8, maxWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>{s.title}</div>
                  {s.url ? (
                    <div style={{ fontSize: 11, color: t.textMuted, wordBreak: "break-all" }}>{s.url}</div>
                  ) : null}
                  {s.lastError ? (
                    <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 4 }}>{s.lastError}</div>
                  ) : null}
                </td>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>{s.sourceType}</td>
                <td style={{ padding: 8 }}>{s.status}</td>
                <td style={{ padding: 8 }}>{s.chunkCount}</td>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                  {s.isVirtual ? (
                    <span style={{ color: t.textMuted }}>읽기 전용</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy === s.id}
                        onClick={() => void collect(s.id)}
                        style={{ marginRight: 6, fontSize: 11, fontWeight: 700, cursor: busy === s.id ? "wait" : "pointer" }}
                      >
                        수집+청크
                      </button>
                      <button
                        type="button"
                        disabled={busy === s.id}
                        onClick={() => void collect(s.id, { collectOnly: true })}
                        style={{ marginRight: 6, fontSize: 11, fontWeight: 700, cursor: busy === s.id ? "wait" : "pointer" }}
                      >
                        수집만
                      </button>
                      <button
                        type="button"
                        disabled={busy === s.id}
                        onClick={() => void collect(s.id, { rechunkOnly: true })}
                        style={{ marginRight: 6, fontSize: 11, fontWeight: 700, cursor: busy === s.id ? "wait" : "pointer" }}
                      >
                        재청크
                      </button>
                      <button type="button" disabled={busy === s.id} onClick={() => void disable(s.id)} style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c", cursor: busy === s.id ? "wait" : "pointer" }}>
                        비활성
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: 10, border: `1px solid ${t.border}`, borderRadius: t.radiusMd }}>
        <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 4 }}>RAG 검색 테스트</div>
        <p style={{ fontSize: 11, color: t.textMuted, margin: "0 0 8px", lineHeight: 1.45 }}>
          KEYWORD 기반 검색 결과입니다. 아래에서 AI개발자 프롬프트에 붙는 Markdown 형식 컨텍스트를 별도로 생성할 수 있습니다.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 200px", fontSize: 11, fontWeight: 700 }}>
            검색어
            <input value={retrieveQuery} onChange={(e) => setRetrieveQuery(e.target.value)} style={{ ...fieldStyle(), marginTop: 4 }} />
          </label>
          <button
            type="button"
            disabled={busy === "retrieve"}
            onClick={() => void tryRetrieve()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              fontWeight: 800,
              fontSize: 12,
              cursor: busy === "retrieve" ? "wait" : "pointer",
            }}
          >
            검색
          </button>
          <button
            type="button"
            disabled={busy === "promptContext"}
            onClick={() => void buildPromptContextPreview()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${t.accentTealFg}`,
              background: "#f0fdfa",
              fontWeight: 800,
              fontSize: 12,
              cursor: busy === "promptContext" ? "wait" : "pointer",
              color: t.accentTealFg,
            }}
          >
            프롬프트 컨텍스트 미리보기
          </button>
        </div>
        {retrieveResult && !retrieveResult.ok ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>{retrieveResult.message}</div>
        ) : null}
        {retrieveResult?.ok ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 6 }}>
              <span style={{ fontWeight: 800 }}>mode</span> {retrieveResult.mode ?? "—"} ·{" "}
              <span style={{ fontWeight: 800 }}>diagnostics</span> {(retrieveResult.diagnostics ?? []).join(" · ")}
            </div>
            <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 4 }}>결과 청크</div>
            <div style={{ overflowX: "auto", maxHeight: 200, overflowY: "auto", border: `1px solid ${t.border}`, borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ padding: 6, textAlign: "left" }}>score</th>
                    <th style={{ padding: 6, textAlign: "left" }}>source</th>
                    <th style={{ padding: 6, textAlign: "left" }}>url</th>
                    <th style={{ padding: 6, textAlign: "left" }}>excerpt</th>
                  </tr>
                </thead>
                <tbody>
                  {(retrieveResult.chunks ?? []).map((c) => (
                    <tr key={c.chunkId} style={{ borderTop: `1px solid ${t.border}` }}>
                      <td style={{ padding: 6, whiteSpace: "nowrap" }}>{c.score}</td>
                      <td style={{ padding: 6 }}>{c.sourceTitle}</td>
                      <td style={{ padding: 6, wordBreak: "break-all", maxWidth: 140 }}>{c.sourceUrl ?? "—"}</td>
                      <td style={{ padding: 6, wordBreak: "break-word" }}>{c.excerpt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontWeight: 800, fontSize: 11, marginTop: 10, marginBottom: 4 }}>promptContext 미리보기</div>
            <pre
              style={{
                margin: 0,
                fontSize: 11,
                maxHeight: 160,
                overflow: "auto",
                background: "#0f172a",
                color: "#e2e8f0",
                padding: 8,
                borderRadius: 6,
                whiteSpace: "pre-wrap",
              }}
            >
              {(retrieveResult.promptContext ?? []).join("\n---\n")}
            </pre>
          </div>
        ) : null}
        <div style={{ fontWeight: 800, fontSize: 12, marginTop: 14, marginBottom: 6 }}>프롬프트 컨텍스트 미리보기</div>
        <p style={{ fontSize: 11, color: t.textMuted, margin: "0 0 6px", lineHeight: 1.45 }}>
          위 검색어로 `## Knowledge Pack Context` 블록을 생성합니다. Cursor 실행 프롬프트에 선택적으로 붙일 수 있습니다.
        </p>
        {promptContextPreview ? (
          <>
            <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 6 }}>
              <span style={{ fontWeight: 800 }}>diagnostics</span> {promptContextPreview.diagnostics.join(" · ") || "—"}
            </div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSecondary }}>
              contextText (읽기 전용)
              <textarea
                readOnly
                value={promptContextPreview.text}
                rows={12}
                style={{ ...fieldStyle(), marginTop: 4, fontFamily: "ui-monospace, monospace", fontSize: 11, lineHeight: 1.45 }}
              />
            </label>
          </>
        ) : (
          <div style={{ fontSize: 11, color: t.textMuted }}>「프롬프트 컨텍스트 미리보기」를 누르면 이곳에 표시됩니다.</div>
        )}
      </div>

      <div style={{ marginTop: 14, padding: 10, border: `1px solid ${t.border}`, borderRadius: t.radiusMd, background: "#fafafa" }}>
        <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>AI개발자 프롬프트 주입 미리보기</div>
        <p style={{ fontSize: 11, color: t.textMuted, margin: "0 0 8px", lineHeight: 1.45 }}>
          요구·작업 설명으로 룰 기반 추천을 받고, 선택한 지식팩을 병합한 `contextText`를 확인합니다. 자동 실행 파이프라인과 별개입니다.
        </p>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSecondary, marginBottom: 8 }}>
          작업 설명 (비우면 위 RAG 검색어 사용)
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
            disabled={busy === "injectRec"}
            onClick={() => void runInjectRecommend()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              fontWeight: 800,
              fontSize: 12,
              cursor: busy === "injectRec" ? "wait" : "pointer",
            }}
          >
            관련 지식팩 추천
          </button>
          <button
            type="button"
            disabled={busy === "injectCtx" || !injectRecs.length}
            onClick={() => void runInjectBuildContext()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: t.accentTeal,
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: busy === "injectCtx" ? "wait" : "pointer",
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
                    onChange={(e) =>
                      setInjectSelected((prev) => ({ ...prev, [row.knowledgePackId]: e.target.checked }))
                    }
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
    </div>
  );
}
