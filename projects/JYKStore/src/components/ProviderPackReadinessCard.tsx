import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";

export function ProviderPackReadinessCard({
  pack,
}: {
  readonly pack: ProviderPackDetailDto;
}) {
  const versionCount = pack.versions.length;
  const sourceDocumentCount = pack.versions.flatMap((v) => v.sourceDocuments).length;
  const isDraft = pack.status === "DRAFT";
  const isReviewing = pack.status === "REVIEWING";
  const isPublic = pack.status === "PUBLISHED" || pack.status === "VERIFIED";
  const canSubmit = isDraft && versionCount > 0 && sourceDocumentCount > 0;

  const catalogAccess = isPublic ? "허용됨" : "차단됨";
  const contextAccess = isPublic ? "허용됨" : "차단됨";

  let statusNote = "";
  if (isDraft) {
    statusNote =
      "검수 요청 전까지 일반 카탈로그와 Context API에는 노출되지 않습니다.";
  } else if (isReviewing) {
    statusNote =
      "검수 중입니다. 승인 전까지 일반 카탈로그와 Context API에는 노출되지 않습니다.";
  } else if (isPublic) {
    statusNote = "공개 상태입니다. 일반 카탈로그와 Context API에서 접근할 수 있습니다.";
  }

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">공개 전 상태 점검</h2>
      {statusNote ? <p className="mt-2 text-xs leading-relaxed text-store-muted">{statusNote}</p> : null}
      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex justify-between gap-2">
          <span className="text-store-muted">일반 카탈로그 노출</span>
          <span className="font-semibold text-slate-900">{catalogAccess}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-store-muted">Context API 접근</span>
          <span className="font-semibold text-slate-900">{contextAccess}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-store-muted">버전</span>
          <span className="font-semibold text-slate-900">{versionCount}개</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-store-muted">원천 문서</span>
          <span className="font-semibold text-slate-900">{sourceDocumentCount}개</span>
        </li>
        {isDraft ? (
          <li className="flex justify-between gap-2">
            <span className="text-store-muted">검수 요청 가능</span>
            <span className="font-semibold text-slate-900">{canSubmit ? "가능" : "불가"}</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
