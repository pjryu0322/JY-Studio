export function SearchEntry(p: { readonly onPress?: () => void }) {
  return (
    <button
      type="button"
      onClick={p.onPress}
      className="flex w-full items-center gap-2 rounded-xl border border-store-border bg-white px-3 py-2.5 text-left shadow-sm active:bg-slate-50"
      aria-label="지식팩 검색"
    >
      <svg className="text-store-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3-3" />
      </svg>
      <span className="text-sm text-store-muted">지식팩, API, 태그 검색</span>
    </button>
  );
}
