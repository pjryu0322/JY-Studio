"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createProviderPackApi } from "@/lib/provider-center-api";
import { providerPackDetailPath } from "@/lib/routes";

type CategoryOption = {
  categoryId: string;
  name: string;
};

export function ProviderPackCreateForm({
  categories,
}: {
  readonly categories: CategoryOption[];
}) {
  const router = useRouter();
  const [packId, setPackId] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.categoryId ?? "");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [version, setVersion] = useState("0.1.0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const data = await createProviderPackApi({
        packId: packId.trim(),
        name,
        categoryId,
        shortDescription,
        description,
        tags,
        version,
      });
      router.push(`${providerPackDetailPath(data.pack.packId)}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "지식팩을 만들지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}
      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="pack-id">
          Pack ID
        </label>
        <input
          id="pack-id"
          value={packId}
          onChange={(e) => setPackId(e.target.value)}
          placeholder="sample-auth-guide"
          className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="pack-name">
          이름
        </label>
        <input
          id="pack-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="pack-category">
          카테고리
        </label>
        <select
          id="pack-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        >
          {categories.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="pack-short">
          짧은 설명
        </label>
        <textarea
          id="pack-short"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="pack-desc">
          설명
        </label>
        <textarea
          id="pack-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="pack-tags">
          태그 (쉼표 구분)
        </label>
        <input
          id="pack-tags"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="pack-version">
          초기 버전
        </label>
        <input
          id="pack-version"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
      >
        {saving ? "생성 중…" : "지식팩 초안 만들기"}
      </button>
    </form>
  );
}
