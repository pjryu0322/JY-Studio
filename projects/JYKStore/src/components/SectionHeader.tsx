export function SectionHeader(p: {
  readonly title: string;
  readonly subtitle?: string;
  readonly actionLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2 px-1">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">{p.title}</h2>
        {p.subtitle ? <p className="mt-0.5 text-xs text-store-muted">{p.subtitle}</p> : null}
      </div>
      {p.actionLabel ? (
        <button type="button" className="shrink-0 text-sm font-semibold text-store-accent">
          {p.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
