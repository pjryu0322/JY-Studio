"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminCategoryDto, AdminCategoryTreeNode } from "@/lib/admin-category-service";
import {
  createAdminCategoryApi,
  deleteAdminCategoryApi,
  fetchAdminCategoriesApi,
  updateAdminCategoryApi,
} from "@/lib/admin-category-api";

type FormState = {
  categoryId: string;
  name: string;
  description: string;
  icon: string;
  parentCategoryId: string;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  categoryId: "",
  name: "",
  description: "",
  icon: "📁",
  parentCategoryId: "",
  sortOrder: "0",
};

function flattenTree(
  nodes: AdminCategoryTreeNode[],
  depth = 0,
): Array<AdminCategoryDto & { depth: number }> {
  const out: Array<AdminCategoryDto & { depth: number }> = [];
  for (const node of nodes) {
    out.push({ ...node, depth });
    out.push(...flattenTree(node.children, depth + 1));
  }
  return out;
}

export function AdminCategoryManager({
  initialItems,
  initialTree,
}: {
  readonly initialItems?: AdminCategoryDto[];
  readonly initialTree?: AdminCategoryTreeNode[];
}) {
  const hasInitial = Boolean(initialTree && initialTree.length > 0);
  const [tree, setTree] = useState<AdminCategoryTreeNode[]>(initialTree ?? []);
  const [items, setItems] = useState<AdminCategoryDto[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const flat = useMemo(() => flattenTree(tree), [tree]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminCategoriesApi();
      setTree(res.tree);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "카테고리 목록을 불러오지 못했습니다.");
      if (!hasInitial) {
        setTree([]);
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [hasInitial]);

  useEffect(() => {
    if (hasInitial) return;
    void refresh();
  }, [hasInitial, refresh]);

  const startCreate = (parentCategoryId?: string) => {
    setEditingId(null);
    setFormOpen(true);
    setForm({
      ...EMPTY_FORM,
      parentCategoryId: parentCategoryId ?? "",
    });
    setMessage(null);
    setError(null);
  };

  const startEdit = (item: AdminCategoryDto) => {
    setEditingId(item.categoryId);
    setFormOpen(true);
    setForm({
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      icon: item.icon,
      parentCategoryId: item.parentCategoryId ?? "",
      sortOrder: String(item.sortOrder),
    });
    setMessage(null);
    setError(null);
  };

  const cancelForm = () => {
    setEditingId(null);
    setFormOpen(false);
    setForm(EMPTY_FORM);
  };

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        icon: form.icon,
        parentCategoryId: form.parentCategoryId.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
      };

      if (editingId) {
        await updateAdminCategoryApi(editingId, payload);
        setMessage(`「${form.name}」카테고리를 수정했습니다.`);
      } else {
        await createAdminCategoryApi({
          ...payload,
          categoryId: form.categoryId,
        });
        setMessage(`「${form.name}」카테고리를 추가했습니다.`);
      }
      cancelForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (item: AdminCategoryDto) => {
    if (
      !window.confirm(
        `「${item.name}」카테고리를 삭제할까요?\n하위 카테고리와 지식팩이 없어야 삭제할 수 있습니다.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await deleteAdminCategoryApi(item.categoryId);
      setMessage(`「${item.name}」카테고리를 삭제했습니다.`);
      if (editingId === item.categoryId) cancelForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const parentOptions = items.filter((item) => item.categoryId !== editingId);
  const formTitle = editingId
    ? "카테고리 수정"
    : form.parentCategoryId
      ? "하위 카테고리 추가"
      : "상위 카테고리 추가";

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-store-muted">
          상위·하위 카테고리를 추가·수정하고, 지식팩이 없는 항목만 삭제할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => startCreate()}
          className="min-h-[36px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white"
        >
          상위 카테고리 추가
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      {formOpen ? (
        <section className="rounded-xl border border-store-border bg-white p-3 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{formTitle}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
              카테고리 ID
              <input
                value={form.categoryId}
                onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                disabled={Boolean(editingId) || busy}
                placeholder="예: auth-sso"
                className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm disabled:bg-slate-50"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              이름
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={busy}
                className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              아이콘
              <input
                value={form.icon}
                onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                disabled={busy}
                className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
              설명
              <input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                disabled={busy}
                className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              상위 카테고리
              <select
                value={form.parentCategoryId}
                onChange={(e) => setForm((prev) => ({ ...prev, parentCategoryId: e.target.value }))}
                disabled={busy}
                className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
              >
                <option value="">없음 (상위 카테고리)</option>
                {parentOptions.map((item) => (
                  <option key={item.categoryId} value={item.categoryId}>
                    {item.name} ({item.categoryId})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              정렬 순서
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                disabled={busy}
                className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSubmit()}
              className="min-h-[36px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? "저장 중…" : editingId ? "수정 저장" : "추가"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelForm}
              className="min-h-[36px] rounded-xl border border-store-border px-3 text-xs font-semibold text-slate-700"
            >
              취소
            </button>
          </div>
        </section>
      ) : null}

      {loading ? <div className="min-h-[120px] rounded-xl bg-slate-50" aria-hidden /> : null}

      {!loading ? (
        <ul className="space-y-1.5">
          {flat.length === 0 ? (
            <li className="rounded-xl border border-store-border bg-white p-4 text-sm text-store-muted">
              등록된 카테고리가 없습니다. 상위 카테고리를 추가해 주세요.
            </li>
          ) : (
            flat.map((item) => (
              <li
                key={item.categoryId}
                className="rounded-xl border border-store-border bg-white px-3 py-2.5 shadow-sm"
                style={{ marginLeft: item.depth * 16 }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none" aria-hidden>
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                      {item.depth > 0 ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          하위
                        </span>
                      ) : (
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          상위
                        </span>
                      )}
                      <code className="text-[10px] text-store-muted">{item.categoryId}</code>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-store-muted">{item.description || "—"}</p>
                    <p className="mt-1 text-[10px] text-store-muted">
                      지식팩 {item.packCount} · 하위 {item.childCount} · 정렬 {item.sortOrder}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startCreate(item.categoryId)}
                      className="rounded-lg border border-store-border px-2 py-1 text-[10px] font-semibold text-slate-700"
                    >
                      하위 추가
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(item)}
                      className="rounded-lg border border-store-border px-2 py-1 text-[10px] font-semibold text-slate-700"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onDelete(item)}
                      className="rounded-lg border border-red-100 px-2 py-1 text-[10px] font-semibold text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
