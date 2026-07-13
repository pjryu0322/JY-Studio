export function PackEmptyDetailNotice({
  downloadAvailable,
}: {
  readonly downloadAvailable: boolean;
}) {
  if (!downloadAvailable) return null;
  return (
    <section className="rounded-2xl border border-dashed border-store-border bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-800">상세 콘텐츠 정보는 준비 중입니다.</p>
      <p className="mt-1 text-sm leading-relaxed text-store-muted">
        원본문서는 다운로드하여 확인할 수 있습니다.
      </p>
    </section>
  );
}
