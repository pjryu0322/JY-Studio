"use client";

/**
 * Workbench step2 — 품질점검 영역 표식 컴포넌트.
 * 실제 품질점검 UI는 AdminKnowledgeGenerationPanel(AdminWorkerZipGenerationCard)
 * 내부 `#admin-quality-section`에 렌더된다. 이중 폴링을 피하기 위해
 * 별도 state owner를 두지 않는다.
 */
export function AdminQualityCheckPanel({
  note = "품질점검은 위 생성 패널의 「품질 점검」 섹션에서 실행합니다.",
}: {
  readonly note?: string;
}) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-store-muted">
      {note} 생성 완료 후 차단/주의 이슈를 확인하고, 필요하면 아래 보정 패널로 이어가세요.
    </p>
  );
}
