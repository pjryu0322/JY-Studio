export function PackFeatureList(p: { readonly items: readonly string[] }) {
  if (!p.items.length) {
    return <p className="text-sm text-store-muted">준비 중입니다.</p>;
  }
  return (
    <ul className="space-y-2">
      {p.items.map((item) => (
        <li key={item} className="flex gap-2 text-sm text-slate-700">
          <span className="text-store-accent" aria-hidden>
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
