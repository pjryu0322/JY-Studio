import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import { getPipelineStatusLabel } from "@/lib/pipeline-dto";
import { getSourceTypeLabel } from "@/lib/source-type-dto";
import {
  countSourceValidationFromStatuses,
  meetsSourceValidationSubmitGate,
} from "@/lib/source-validation-readiness";
import {
  getStructureQualityBlockingMessage,
  meetsStructureQualityGate,
  structureQualityGateSnapshotFromSummary,
} from "@/lib/structure-quality/structure-quality-readiness";

export function ProviderPackReadinessCard({
  pack,
}: {
  readonly pack: ProviderPackDetailDto;
}) {
  const docs = pack.versions.flatMap((v) => v.sourceDocuments);
  const versionCount = pack.versions.length;
  const sourceDocumentCount = docs.length;
  const validation = countSourceValidationFromStatuses(docs.map((d) => d.validationStatus));
  const { passCount, warningCount, failCount, notCheckedCount } = validation;
  const isDraft = pack.status === "DRAFT";
  const isReviewing = pack.status === "REVIEWING";
  const isPublic = pack.status === "PUBLISHED" || pack.status === "VERIFIED";
  const structureGate = structureQualityGateSnapshotFromSummary(pack.structureQuality ?? null);
  const structureBlockMessage = getStructureQualityBlockingMessage(
    structureGate,
    pack.structureQuality,
  );
  const canSubmit =
    isDraft &&
    versionCount > 0 &&
    sourceDocumentCount > 0 &&
    meetsSourceValidationSubmitGate(validation) &&
    meetsStructureQualityGate(structureGate);

  const typeCoverage = docs.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.sourceType] = (acc[doc.sourceType] ?? 0) + 1;
    return acc;
  }, {});

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
          <span className="text-store-muted">공정 상태</span>
          <span className="font-semibold text-slate-900">
            {getPipelineStatusLabel(pack.pipelineStatus)}
          </span>
        </li>
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
        <li className="flex justify-between gap-2">
          <span className="text-store-muted">검증 요약</span>
          <span className="text-right text-xs font-semibold text-slate-900">
            통과 {passCount} · 주의 {warningCount} · 실패{" "}
            <span className={failCount > 0 ? "text-red-700" : undefined}>{failCount}</span> · 미검사{" "}
            <span className={notCheckedCount > 0 ? "text-red-700" : undefined}>
              {notCheckedCount}
            </span>
          </span>
        </li>
        {isDraft ? (
          <li className="flex justify-between gap-2">
            <span className="text-store-muted">검수 요청 가능</span>
            <span className="font-semibold text-slate-900">{canSubmit ? "가능" : "불가"}</span>
          </li>
        ) : null}
      </ul>

      {sourceDocumentCount > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(typeCoverage).map(([type, count]) => (
            <span
              key={type}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              {getSourceTypeLabel(type)} {count}
            </span>
          ))}
        </div>
      ) : null}

      {failCount > 0 ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          검증 실패(FAIL) 문서가 있어 검수 요청을 제출할 수 없습니다.
        </p>
      ) : null}
      {notCheckedCount > 0 ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          검증되지 않은(NOT_CHECKED) 문서가 있어 검수 요청을 제출할 수 없습니다. 원천 문서를 다시
          등록하거나 검증 상태를 갱신해 주세요.
        </p>
      ) : null}
      {warningCount > 0 && failCount === 0 && notCheckedCount === 0 ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
          주의(WARNING) 상태 문서가 있습니다. 제출은 가능하지만 검수 전 권장 항목을 확인해 주세요.
        </p>
      ) : null}
      {!meetsStructureQualityGate(structureGate) ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {structureBlockMessage ??
            "구조/품질 점검을 실행하고 FAIL 결과가 없어야 검수 요청을 제출할 수 있습니다."}
        </p>
      ) : null}
      {meetsStructureQualityGate(structureGate) &&
      (structureGate.structureCoverageStatus === "WARNING" ||
        structureGate.knowledgeQualityStatus === "WARNING") ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
          구조 커버리지 또는 지식 품질이 WARNING입니다. 제출은 가능하나 보완을 권장합니다.
        </p>
      ) : null}
    </section>
  );
}
