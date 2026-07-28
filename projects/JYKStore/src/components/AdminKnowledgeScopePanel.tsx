"use client";

/**
 * P3 KNOWLEDGE_SCOPE workbench — Inventory DB SoT for include/exclude.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminKnowledgeScopePreviewUrl,
  bulkAdminKnowledgeScopeItems,
  ensureAdminKnowledgeScope,
  fetchAdminKnowledgeScope,
  fetchAdminKnowledgeScopeItems,
  finalizeAdminKnowledgeScope,
  patchAdminKnowledgeScopeItem,
  type AdminKnowledgeScopeItem,
  type AdminKnowledgeScopeSummary,
} from "@/lib/admin-review-api";

function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function decisionLabel(d: AdminKnowledgeScopeItem["decision"]): string {
  switch (d) {
    case "INCLUDED":
      return "포함";
    case "EXCLUDED":
      return "제외";
    case "REVIEW_REQUIRED":
      return "확인 필요";
    default:
      return "미결정";
  }
}

function sourceLabel(s: AdminKnowledgeScopeItem["decisionSource"]): string {
  switch (s) {
    case "SYSTEM":
      return "시스템";
    case "ADMIN":
      return "관리자";
    case "PROVIDER":
      return "제공자";
    default:
      return s;
  }
}

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "text"; text: string; truncated: boolean; path: string }
  | { status: "media"; url: string; kind: "pdf" | "image"; path: string }
  | { status: "unsupported"; message: string; path: string }
  | { status: "error"; message: string };

export function AdminKnowledgeScopePanel({
  packId,
  packName,
  onScopeReadyChange,
  onGoGeneration,
}: {
  readonly packId: string;
  readonly packName?: string | null;
  readonly onScopeReadyChange?: (ready: boolean) => void;
  readonly onGoGeneration?: () => void;
}) {
  const [summary, setSummary] = useState<AdminKnowledgeScopeSummary | null>(null);
  const [canFinalize, setCanFinalize] = useState(false);
  const [readyForGeneration, setReadyForGeneration] = useState(false);
  const [items, setItems] = useState<AdminKnowledgeScopeItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [pathPrefix, setPathPrefix] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [providerNote, setProviderNote] = useState("");
  const [excludeReason, setExcludeReason] = useState("");

  const pageSize = 50;

  const applySummary = useCallback(
    (data: {
      inventory: AdminKnowledgeScopeSummary | null;
      canFinalize: boolean;
      readyForGeneration: boolean;
    }) => {
      setSummary(data.inventory);
      setCanFinalize(data.canFinalize);
      setReadyForGeneration(data.readyForGeneration);
      onScopeReadyChange?.(data.readyForGeneration);
    },
    [onScopeReadyChange],
  );

  const loadSummary = useCallback(async () => {
    const data = await fetchAdminKnowledgeScope(packId);
    applySummary(data);
    return data;
  }, [applySummary, packId]);

  const loadItems = useCallback(async () => {
    const data = await fetchAdminKnowledgeScopeItems(packId, {
      page,
      pageSize,
      q: q || undefined,
      decision: decisionFilter || undefined,
      pathPrefix: pathPrefix || undefined,
    });
    setItems(data.items);
    setTotal(data.total);
    setTotalPages(data.totalPages);
  }, [decisionFilter, packId, page, pathPrefix, q]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data = await loadSummary();
      if (!data.inventory) {
        data = await ensureAdminKnowledgeScope(packId);
        applySummary(data);
      }
      if (data.inventory) {
        await loadItems();
      } else {
        setItems([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "인벤토리를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [applySummary, loadItems, loadSummary, packId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!summary) return;
    void loadItems().catch((err) => {
      setError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다.");
    });
  }, [loadItems, summary]);

  const counts = summary?.counts;
  const finalized = summary?.status === "FINALIZED";

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeItemId) ?? null,
    [activeItemId, items],
  );

  const loadPreview = useCallback(
    async (item: AdminKnowledgeScopeItem) => {
      setActiveItemId(item.id);
      setPreview({ status: "loading" });
      try {
        const url = adminKnowledgeScopePreviewUrl(packId, item.id);
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          const msg = await response.text();
          throw new Error(msg || `미리보기 실패 (${response.status})`);
        }
        const contentType = response.headers.get("Content-Type") ?? "";
        if (contentType.includes("application/json")) {
          const data = (await response.json()) as {
            preview?: {
              kind: string;
              text?: string;
              truncated?: boolean;
              message?: string;
              relativePath?: string;
            };
          };
          const p = data.preview;
          if (!p) throw new Error("미리보기 응답이 비어 있습니다.");
          if (p.kind === "text") {
            setPreview({
              status: "text",
              text: p.text ?? "",
              truncated: Boolean(p.truncated),
              path: p.relativePath ?? item.relativePath,
            });
            return;
          }
          setPreview({
            status: "unsupported",
            message: p.message ?? "미리보기를 지원하지 않습니다.",
            path: p.relativePath ?? item.relativePath,
          });
          return;
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const kind = response.headers.get("X-Preview-Kind") === "pdf" ? "pdf" : "image";
        setPreview((prev) => {
          if (prev.status === "media") URL.revokeObjectURL(prev.url);
          return { status: "media", url: objectUrl, kind, path: item.relativePath };
        });
      } catch (err) {
        setPreview({
          status: "error",
          message: err instanceof Error ? err.message : "미리보기에 실패했습니다.",
        });
      }
    },
    [packId],
  );

  useEffect(() => {
    return () => {
      if (preview.status === "media") URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const runAction = useCallback(
    async (
      action: "INCLUDE" | "EXCLUDE" | "REQUEST_PROVIDER" | "CLEAR_TO_REVIEW",
      itemIds: string[],
    ) => {
      if (itemIds.length === 0) return;
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const body = {
          itemIds,
          action,
          exclusionReasonCode: action === "EXCLUDE" ? ("ADMIN_DECISION" as const) : undefined,
          exclusionReasonText: action === "EXCLUDE" ? excludeReason.trim() || undefined : undefined,
          providerRequestNote:
            action === "REQUEST_PROVIDER" ? providerNote.trim() || undefined : undefined,
        };
        if (itemIds.length === 1) {
          await patchAdminKnowledgeScopeItem(packId, itemIds[0]!, {
            action,
            exclusionReasonCode: body.exclusionReasonCode,
            exclusionReasonText: body.exclusionReasonText,
            providerRequestNote: body.providerRequestNote,
          });
        } else {
          await bulkAdminKnowledgeScopeItems(packId, body);
        }
        setSelected(new Set());
        setMessage(`판정 ${itemIds.length}건 반영`);
        await loadSummary();
        await loadItems();
      } catch (err) {
        setError(err instanceof Error ? err.message : "판정에 실패했습니다.");
      } finally {
        setBusy(false);
      }
    },
    [excludeReason, loadItems, loadSummary, packId, providerNote],
  );

  const onFinalize = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await finalizeAdminKnowledgeScope(packId);
      applySummary({
        inventory: result.inventory,
        canFinalize: false,
        readyForGeneration: result.readyForGeneration,
      });
      setMessage("지식화 대상 범위가 확정되었습니다.");
      if (result.readyForGeneration) onGoGeneration?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "범위 확정에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }, [applySummary, onGoGeneration, packId]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allPageSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  return (
    <section className="space-y-4">
      <header className="space-y-2 rounded-2xl border border-store-border bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-store-muted">
          지식화 대상 확인
        </p>
        <h2 className="text-lg font-semibold text-store-ink">
          Worker에 넘길 파일 범위를 확정합니다
          {packName ? (
            <span className="ml-2 text-sm font-normal text-store-muted">· {packName}</span>
          ) : null}
        </h2>
        <p className="text-sm text-store-muted">
          Inventory DB가 포함/제외의 유일한 기준입니다. 제외는 파일 삭제가 아니라 상태입니다.
        </p>

        {counts ? (
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["전체", counts.total],
              ["포함", counts.included],
              ["시스템 제외", counts.excludedBySystem],
              ["관리자 제외", counts.excludedByAdmin],
              ["확인 필요", counts.reviewRequired + counts.pending],
              ["제공자 확인", counts.providerRequested],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-store-border bg-store-surface px-3 py-2"
              >
                <p className="text-[11px] text-store-muted">{label}</p>
                <p className="text-base font-semibold text-store-ink">{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            disabled={busy || loading}
            className="rounded-xl border border-store-border px-3 py-1.5 text-sm hover:bg-store-surface"
            onClick={() => void refresh()}
          >
            새로고침
          </button>
          <button
            type="button"
            disabled={busy || finalized || !canFinalize}
            className="rounded-xl bg-store-ink px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            onClick={() => void onFinalize()}
          >
            {finalized ? "범위 확정됨" : "대상 확정 후 생성으로"}
          </button>
          {readyForGeneration ? (
            <button
              type="button"
              className="rounded-xl border border-store-border px-3 py-1.5 text-sm hover:bg-store-surface"
              onClick={() => onGoGeneration?.()}
            >
              생성 단계로
            </button>
          ) : null}
          {summary ? (
            <span className="text-xs text-store-muted">
              상태 {summary.status}
              {summary.finalizedAt ? ` · ${new Date(summary.finalizedAt).toLocaleString("ko-KR")}` : ""}
            </span>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-store-muted">인벤토리 불러오는 중…</p>
      ) : !summary ? (
        <p className="text-sm text-store-muted">
          인벤토리가 없습니다. 접수 후 자동 생성되거나 새로고침으로 생성할 수 있습니다.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <input
                className="min-w-[10rem] flex-1 rounded-lg border border-store-border px-2 py-1.5 text-sm"
                placeholder="파일명·경로 검색"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setQ(qDraft.trim());
                  }
                }}
              />
              <input
                className="min-w-[8rem] rounded-lg border border-store-border px-2 py-1.5 text-sm"
                placeholder="경로 prefix"
                value={pathPrefix}
                onChange={(e) => {
                  setPage(1);
                  setPathPrefix(e.target.value);
                }}
              />
              <select
                className="rounded-lg border border-store-border px-2 py-1.5 text-sm"
                value={decisionFilter}
                onChange={(e) => {
                  setPage(1);
                  setDecisionFilter(e.target.value);
                }}
              >
                <option value="">전체 판정</option>
                <option value="PENDING">미결정</option>
                <option value="INCLUDED">포함</option>
                <option value="EXCLUDED">제외</option>
                <option value="REVIEW_REQUIRED">확인 필요</option>
              </select>
              <button
                type="button"
                className="rounded-lg border border-store-border px-3 py-1.5 text-sm"
                onClick={() => {
                  setPage(1);
                  setQ(qDraft.trim());
                }}
              >
                검색
              </button>
            </div>

            {!finalized ? (
              <div className="flex flex-wrap items-end gap-2 rounded-xl bg-store-surface p-2">
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  onClick={() => void runAction("INCLUDE", [...selected])}
                >
                  포함
                </button>
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  className="rounded-lg bg-stone-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  onClick={() => void runAction("EXCLUDE", [...selected])}
                >
                  제외
                </button>
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  className="rounded-lg border border-store-border px-3 py-1.5 text-xs disabled:opacity-40"
                  onClick={() => void runAction("CLEAR_TO_REVIEW", [...selected])}
                >
                  재검토
                </button>
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 disabled:opacity-40"
                  onClick={() => void runAction("REQUEST_PROVIDER", [...selected])}
                >
                  제공자 확인 요청
                </button>
                <input
                  className="min-w-[8rem] flex-1 rounded-lg border border-store-border px-2 py-1 text-xs"
                  placeholder="제외 사유(선택)"
                  value={excludeReason}
                  onChange={(e) => setExcludeReason(e.target.value)}
                />
                <input
                  className="min-w-[8rem] flex-1 rounded-lg border border-store-border px-2 py-1 text-xs"
                  placeholder="제공자 요청 메모"
                  value={providerNote}
                  onChange={(e) => setProviderNote(e.target.value)}
                />
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-store-border text-xs text-store-muted">
                  <tr>
                    <th className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        disabled={finalized}
                        onChange={() => {
                          if (allPageSelected) {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              for (const i of items) next.delete(i.id);
                              return next;
                            });
                          } else {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              for (const i of items) next.add(i.id);
                              return next;
                            });
                          }
                        }}
                      />
                    </th>
                    <th className="px-2 py-2">파일</th>
                    <th className="px-2 py-2">확장자</th>
                    <th className="px-2 py-2">크기</th>
                    <th className="px-2 py-2">판정</th>
                    <th className="px-2 py-2">주체</th>
                    <th className="px-2 py-2">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-store-border/60 hover:bg-store-surface/80 ${
                        activeItemId === item.id ? "bg-store-surface" : ""
                      }`}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          disabled={finalized}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                      <td className="max-w-[18rem] px-2 py-2">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => void loadPreview(item)}
                        >
                          <span className="block truncate font-medium text-store-ink">
                            {item.fileName}
                          </span>
                          <span className="block truncate text-xs text-store-muted">
                            {item.relativePath}
                          </span>
                        </button>
                      </td>
                      <td className="px-2 py-2 text-xs">{item.extension || "—"}</td>
                      <td className="px-2 py-2 text-xs">{formatBytes(item.sizeBytes)}</td>
                      <td className="px-2 py-2 text-xs">
                        {decisionLabel(item.decision)}
                        {item.providerDecisionStatus === "REQUESTED" ? (
                          <span className="ml-1 text-amber-700">·제공자</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-xs">{sourceLabel(item.decisionSource)}</td>
                      <td className="max-w-[10rem] truncate px-2 py-2 text-xs text-store-muted">
                        {item.exclusionReasonCode ?? item.exclusionReasonText ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 text-center text-sm text-store-muted">
                        조건에 맞는 항목이 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-store-muted">
              <span>
                {total}건 · {page}/{Math.max(totalPages, 1)}페이지
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-store-border px-2 py-1 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  이전
                </button>
                <button
                  type="button"
                  className="rounded border border-store-border px-2 py-1 disabled:opacity-40"
                  disabled={totalPages === 0 || page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-store-ink">미리보기</h3>
            {!activeItem ? (
              <p className="text-sm text-store-muted">파일을 선택하면 미리봅니다.</p>
            ) : (
              <div className="space-y-2 text-xs text-store-muted">
                <p className="truncate font-medium text-store-ink">{activeItem.fileName}</p>
                <p className="break-all">{activeItem.relativePath}</p>
                <p>
                  {formatBytes(activeItem.sizeBytes)} · {activeItem.extension || "확장자 없음"} ·{" "}
                  {activeItem.previewKind ?? "—"}
                </p>
              </div>
            )}
            {preview.status === "loading" ? (
              <p className="text-sm text-store-muted">불러오는 중…</p>
            ) : null}
            {preview.status === "text" ? (
              <pre className="max-h-[28rem] overflow-auto rounded-lg bg-store-surface p-3 text-xs whitespace-pre-wrap">
                {preview.text}
                {preview.truncated ? "\n\n… (일부만 표시)" : ""}
              </pre>
            ) : null}
            {preview.status === "media" && preview.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={preview.path} className="max-h-[28rem] w-full object-contain" />
            ) : null}
            {preview.status === "media" && preview.kind === "pdf" ? (
              <iframe title={preview.path} src={preview.url} className="h-[28rem] w-full rounded-lg border" />
            ) : null}
            {preview.status === "unsupported" || preview.status === "error" ? (
              <p className="text-sm text-store-muted">
                {"message" in preview ? preview.message : "미리보기를 사용할 수 없습니다."}
              </p>
            ) : null}
          </aside>
        </div>
      )}
    </section>
  );
}
