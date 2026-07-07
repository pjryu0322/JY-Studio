"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { KnowledgeChunkDto, PackChunksListResponse } from "@/lib/chunk-pipeline-dto";
import {
  createPackChunkApi,
  deactivatePackChunkApi,
  fetchPackChunks,
  generateChunksFromDocumentApi,
  updatePackChunkApi,
} from "@/lib/chunk-pipeline-api";
import { includesNormalized, tokenizeSearchQuery } from "@/lib/search-utils";

const METADATA_PLACEHOLDER = `{
  "documentType": "SAMPLE_CODE",
  "programmingLanguage": "Java",
  "framework": "Spring Boot",
  "securityLevel": "PUBLIC"
}`;

function parseTagsText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function parseMetadataText(
  value: string,
): { ok: true; metadata: Record<string, unknown> | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, metadata: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "metadata JSON을 파싱하지 못했습니다." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "metadata는 JSON object여야 합니다." };
  }
  return { ok: true, metadata: parsed as Record<string, unknown> };
}

function formatMetadataSummary(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("/") : String(value)}`)
    .join(" · ");
}

export function AdminChunkManager({ packId }: { readonly packId: string }) {
  const [data, setData] = useState<PackChunksListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [maxChunkChars, setMaxChunkChars] = useState(1200);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const [versionId, setVersionId] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualSection, setManualSection] = useState("");
  const [manualMetadataText, setManualMetadataText] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSection, setEditSection] = useState("");
  const [editTagsText, setEditTagsText] = useState("");
  const [editMetadataText, setEditMetadataText] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [chunkQuery, setChunkQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPackChunks(packId);
      setData(res);
      setVersionId((current) => current || res.versions[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "청크 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onGenerate = async (sourceDocumentId: string) => {
    setGeneratingId(sourceDocumentId);
    setError(null);
    try {
      await generateChunksFromDocumentApi(packId, sourceDocumentId, {
        maxChunkChars,
        overwriteExisting,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "청크 생성에 실패했습니다.");
    } finally {
      setGeneratingId(null);
    }
  };

  const onCreateManual = async (e: FormEvent) => {
    e.preventDefault();
    if (!versionId) return;
    setError(null);

    const metadataResult = parseMetadataText(manualMetadataText);
    if (!metadataResult.ok) {
      setError(metadataResult.error);
      return;
    }

    setCreating(true);
    try {
      await createPackChunkApi(packId, {
        versionId,
        title: manualTitle,
        content: manualContent,
        section: manualSection.trim() || undefined,
        metadata: metadataResult.metadata,
        chunkType: "MANUAL",
      });
      setManualTitle("");
      setManualContent("");
      setManualSection("");
      setManualMetadataText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "청크를 만들지 못했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (chunk: KnowledgeChunkDto) => {
    setEditingId(chunk.id);
    setEditTitle(chunk.title);
    setEditContent(chunk.content);
    setEditSection(chunk.section ?? "");
    setEditTagsText(chunk.tags.join(", "));
    setEditMetadataText(chunk.metadata ? JSON.stringify(chunk.metadata, null, 2) : "");
    setEditSortOrder(String(chunk.sortOrder));
    setEditIsActive(chunk.isActive);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setError(null);

    const metadataResult = parseMetadataText(editMetadataText);
    if (!metadataResult.ok) {
      setError(metadataResult.error);
      return;
    }

    try {
      const parsedSortOrder = Number(editSortOrder);
      await updatePackChunkApi(packId, editingId, {
        title: editTitle,
        content: editContent,
        section: editSection.trim() || null,
        tags: parseTagsText(editTagsText),
        metadata: metadataResult.metadata,
        sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : undefined,
        isActive: editIsActive,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정에 실패했습니다.");
    }
  };

  const onDeactivate = async (chunkId: string) => {
    if (!window.confirm("이 청크를 비활성화할까요? Context API에서 제외됩니다.")) return;
    setError(null);
    try {
      await deactivatePackChunkApi(packId, chunkId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "비활성화에 실패했습니다.");
    }
  };

  if (loading && !data) {
    return <p className="text-sm text-store-muted">청크 정보 불러오는 중…</p>;
  }

  const summary = data?.summary;
  const chunkQueryTokens = tokenizeSearchQuery(chunkQuery);
  const visibleChunks = chunkQueryTokens.length
    ? (data?.chunks ?? []).filter((chunk) => {
        const fields = [chunk.title, chunk.content, chunk.section, chunk.chunkType, ...chunk.tags];
        return chunkQueryTokens.some((token) =>
          fields.some((field) => includesNormalized(field, token)),
        );
      })
    : (data?.chunks ?? []);

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h3 className="text-sm font-bold text-slate-900">Chunk 관리</h3>
      <p className="text-xs text-store-muted">
        승인 전 Context API에 노출될 활성 chunk를 생성·검수합니다. 비활성 chunk는 삭제하지 않고 제외합니다.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {summary ? (
        <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
          <div>버전: {summary.versionCount}</div>
          <div>원천 문서: {summary.sourceDocumentCount}</div>
          <div>전체 chunk: {summary.chunkCount}</div>
          <div>활성: {summary.activeChunkCount}</div>
          <div>비활성: {summary.inactiveChunkCount}</div>
        </dl>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(e) => setOverwriteExisting(e.target.checked)}
          />
          overwriteExisting
        </label>
        <label className="flex items-center gap-2">
          maxChunkChars
          <select
            value={maxChunkChars}
            onChange={(e) => setMaxChunkChars(Number(e.target.value))}
            className="rounded-lg border border-store-border px-2 py-1"
          >
            {[800, 1200, 1600].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {data?.sourceDocuments.length ? (
        <ul className="space-y-2">
          {data.sourceDocuments.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-2 rounded-xl border border-store-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{doc.title}</p>
                <p className="text-xs text-store-muted">
                  {doc.sourceType} · chunk {doc.chunkCount}개
                </p>
              </div>
              <button
                type="button"
                disabled={generatingId === doc.id}
                onClick={() => void onGenerate(doc.id)}
                className="min-h-[44px] shrink-0 rounded-xl border border-store-border bg-white px-3 text-xs font-semibold disabled:opacity-50"
              >
                {generatingId === doc.id ? "생성 중…" : "이 문서에서 chunk 생성"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-store-muted">원천 문서가 없습니다.</p>
      )}

      <form onSubmit={onCreateManual} className="space-y-2 rounded-xl border border-dashed border-store-border p-3">
        <p className="text-xs font-bold text-slate-800">수동 chunk 생성</p>
        <select
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        >
          {data?.versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version}
            </option>
          ))}
        </select>
        <input
          value={manualTitle}
          onChange={(e) => setManualTitle(e.target.value)}
          placeholder="제목"
          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
          required
        />
        <input
          value={manualSection}
          onChange={(e) => setManualSection(e.target.value)}
          placeholder="section (선택)"
          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
        <textarea
          value={manualContent}
          onChange={(e) => setManualContent(e.target.value)}
          placeholder="내용"
          rows={4}
          className="w-full rounded-xl border border-store-border px-3 py-2 text-sm"
          required
        />
        <textarea
          value={manualMetadataText}
          onChange={(e) => setManualMetadataText(e.target.value)}
          placeholder={METADATA_PLACEHOLDER}
          rows={4}
          className="w-full rounded-xl border border-store-border px-3 py-2 font-mono text-xs"
        />
        <p className="text-[11px] text-store-muted">
          metadata(JSON, 선택): 허용된 key만 저장됩니다. Retrieval API filter의 AND 조건으로 사용됩니다.
        </p>
        <button
          type="submit"
          disabled={creating}
          className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {creating ? "생성 중…" : "수동 chunk 추가"}
        </button>
      </form>

      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-800">chunk 목록</p>
        <input
          value={chunkQuery}
          onChange={(e) => setChunkQuery(e.target.value)}
          placeholder="chunk 검색: callback, 오류코드, 인증 요청..."
          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
        {chunkQueryTokens.length > 0 ? (
          <p className="text-xs text-store-muted">
            검색 token {chunkQueryTokens.length}개 기준 {visibleChunks.length}개 chunk가 표시됩니다.
          </p>
        ) : null}
        {!data?.chunks.length ? (
          <p className="text-sm text-store-muted">등록된 chunk가 없습니다.</p>
        ) : visibleChunks.length === 0 ? (
          <p className="text-sm text-store-muted">검색 조건에 맞는 chunk가 없습니다.</p>
        ) : (
          visibleChunks.map((chunk) => (
            <ChunkCard
              key={chunk.id}
              chunk={chunk}
              editing={editingId === chunk.id}
              editTitle={editTitle}
              editContent={editContent}
              editSection={editSection}
              editTagsText={editTagsText}
              editMetadataText={editMetadataText}
              editSortOrder={editSortOrder}
              editIsActive={editIsActive}
              onEditTitle={setEditTitle}
              onEditContent={setEditContent}
              onEditSection={setEditSection}
              onEditTagsText={setEditTagsText}
              onEditMetadataText={setEditMetadataText}
              onEditSortOrder={setEditSortOrder}
              onEditIsActive={setEditIsActive}
              onStartEdit={() => startEdit(chunk)}
              onSaveEdit={() => void saveEdit()}
              onCancelEdit={() => setEditingId(null)}
              onDeactivate={() => void onDeactivate(chunk.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ChunkCard({
  chunk,
  editing,
  editTitle,
  editContent,
  editSection,
  editTagsText,
  editMetadataText,
  editSortOrder,
  editIsActive,
  onEditTitle,
  onEditContent,
  onEditSection,
  onEditTagsText,
  onEditMetadataText,
  onEditSortOrder,
  onEditIsActive,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeactivate,
}: {
  chunk: KnowledgeChunkDto;
  editing: boolean;
  editTitle: string;
  editContent: string;
  editSection: string;
  editTagsText: string;
  editMetadataText: string;
  editSortOrder: string;
  editIsActive: boolean;
  onEditTitle: (v: string) => void;
  onEditContent: (v: string) => void;
  onEditSection: (value: string) => void;
  onEditTagsText: (value: string) => void;
  onEditMetadataText: (value: string) => void;
  onEditSortOrder: (value: string) => void;
  onEditIsActive: (value: boolean) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div className={`rounded-xl border p-3 ${chunk.isActive ? "border-store-border" : "border-slate-200 opacity-70"}`}>
      {editing ? (
        <div className="space-y-2">
          <input
            value={editTitle}
            onChange={(e) => onEditTitle(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
          />
          <textarea
            value={editContent}
            onChange={(e) => onEditContent(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-store-border px-2 py-1 text-sm"
          />
          <input
            value={editSection}
            onChange={(e) => onEditSection(e.target.value)}
            placeholder="section"
            className="min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
          />
          <input
            value={editTagsText}
            onChange={(e) => onEditTagsText(e.target.value)}
            placeholder="tags, comma-separated"
            className="min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
          />
          <textarea
            value={editMetadataText}
            onChange={(e) => onEditMetadataText(e.target.value)}
            placeholder={METADATA_PLACEHOLDER}
            rows={4}
            className="w-full rounded-lg border border-store-border px-2 py-1 font-mono text-xs"
          />
          <p className="text-[11px] text-store-muted">
            metadata(JSON): 비우면 metadata가 제거됩니다.
          </p>
          <input
            value={editSortOrder}
            onChange={(e) => onEditSortOrder(e.target.value)}
            placeholder="sortOrder"
            inputMode="numeric"
            className="min-h-[44px] w-full rounded-lg border border-store-border px-2 text-sm"
          />
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => onEditIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            활성 chunk
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={onSaveEdit} className="min-h-[44px] flex-1 rounded-lg bg-store-accent text-sm font-bold text-white">
              저장
            </button>
            <button type="button" onClick={onCancelEdit} className="min-h-[44px] flex-1 rounded-lg border border-store-border text-sm">
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{chunk.title}</p>
            <span className="text-[10px] text-store-muted">{chunk.chunkType}</span>
            {!chunk.isActive ? <span className="text-[10px] font-bold text-red-700">비활성</span> : null}
          </div>
          <p className="text-xs text-store-muted">
            sortOrder {chunk.sortOrder}
            {chunk.section ? ` · section: ${chunk.section}` : ""}
          </p>
          {chunk.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {chunk.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {chunk.metadata && Object.keys(chunk.metadata).length > 0 ? (
            <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
              metadata · {formatMetadataSummary(chunk.metadata)}
            </p>
          ) : null}
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{chunk.content}</pre>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onStartEdit} className="min-h-[44px] flex-1 rounded-lg border border-store-border text-xs font-semibold">
              수정
            </button>
            {chunk.isActive ? (
              <button type="button" onClick={onDeactivate} className="min-h-[44px] flex-1 rounded-lg border border-red-200 text-xs font-semibold text-red-800">
                비활성화
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
