import type { ReactNode } from "react";

export function PackDetailSection(p: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-base font-bold text-slate-900">{p.title}</h2>
      {p.description ? <p className="mt-1 text-xs text-store-muted">{p.description}</p> : null}
      <div className="mt-3">{p.children}</div>
    </section>
  );
}
