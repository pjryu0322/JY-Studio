import type { ReactNode } from "react";

export function IntegrationStepCard({
  step,
  title,
  children,
}: {
  readonly step: number;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-wide text-store-accent">{step}단계</p>
      <h2 className="mt-1 text-base font-bold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}
