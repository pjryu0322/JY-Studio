"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { parseReferences } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { inferSourceTypeFromReference } from "@/lib/knowledge-packs/knowledgePackSources";

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
  const [retrieveOut, setRetrieveOut] = useState<string>("");

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
        body: JSON.stringify({ knowledgePackId, query: q, topK: 6 }),
      });
      const j = (await r.json()) as { ok?: boolean; chunks?: unknown };
      setRetrieveOut(JSON.stringify(j, null, 2));
    } catch {
      setRetrieveOut("error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, margin: "0 0 10px" }}>
        RAG 1단계: URL 수집(SSRF 차단)·평문 파싱·겹침 청크 저장·키워드 검색 API가 연결되었습니다. 벡터 임베딩·의미 검색은 다음 단계입니다.
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
        <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>키워드 검색 시험 (retrieve-context)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 200px", fontSize: 11, fontWeight: 700 }}>
            질의
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
        </div>
        {retrieveOut ? (
          <pre style={{ marginTop: 8, fontSize: 11, maxHeight: 200, overflow: "auto", background: "#0f172a", color: "#e2e8f0", padding: 8, borderRadius: 6 }}>{retrieveOut}</pre>
        ) : null}
      </div>
    </div>
  );
}
