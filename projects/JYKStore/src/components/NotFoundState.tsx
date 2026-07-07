import Link from "next/link";

export function NotFoundState(p: {
  readonly title: string;
  readonly description: string;
  readonly ctaLabel: string;
  readonly ctaHref: string;
}) {
  return (
    <div className="rounded-2xl border border-store-border bg-white px-6 py-10 text-center shadow-card">
      <p className="text-4xl" aria-hidden>
        🔍
      </p>
      <h2 className="mt-4 text-base font-bold text-slate-900">{p.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-store-muted">{p.description}</p>
      <Link
        href={p.ctaHref}
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent px-6 text-sm font-bold text-white active:opacity-90"
      >
        {p.ctaLabel}
      </Link>
    </div>
  );
}
