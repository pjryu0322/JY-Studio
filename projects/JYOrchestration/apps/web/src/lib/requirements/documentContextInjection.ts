/** LLM classifier 실패 시 엄격 키워드만 (화면/UX/반응형 제외) */
export function shouldInjectDocumentCollaborationContextStrictFallback(input: { readonly text: string }): boolean {
  const t = String(input.text ?? "").trim();
  if (!t) return false;
  return /(PDF|파일\s*업로드|원본\s*보존|문서\s*비교|협업\s*편집|실시간\s*협업|주석|댓글|문서\s*협업|공동\s*검토|원본.*사본)/i.test(t);
}

/** @deprecated classifier 우선 — 규칙 fallback은 {@link shouldInjectDocumentCollaborationContextStrictFallback} */
export function shouldInjectDocumentCollaborationContext(input: { readonly text: string }): boolean {
  const t = String(input.text ?? "").trim();
  if (!t) return false;

  if (/^문서화(해\s*줘|해주세요|만\s*해\s*줘)?[.!?\s]*$/i.test(t)) return false;

  const dashboardLike = /(JSON|대시보드|데이터\s*수집|modoo|크롤링|차트\s*구성)/i.test(t);
  const docCollabStrong =
    /(PDF|파일\s*업로드|원본\s*보존|문서\s*비교|협업\s*편집|실시간\s*협업|주석|댓글|문서\s*협업|페이지\s*공유|원본.*사본)/i.test(
      t
    );
  if (dashboardLike && !docCollabStrong) return false;

  if (docCollabStrong) return true;
  return shouldInjectDocumentCollaborationContextStrictFallback({ text: t });
}

export const DOC_COLLABORATION_HINT = `[문서 협업 맥락]
사용자 발화에 문서·PDF·협업 관련 표현이 있습니다. 답변에는 가능한 범위에서 아래 주제 중 최소 2가지 이상을 구체적으로 다루세요: 원본 보존과 PDF 사본 관계, 문서 업로드 후 PDF 변환·공유 흐름, 실시간 참여자 표시, 상대의 페이지·커서·선택 영역, 주석/댓글, 태그/알림, 변경 이력, 문서 비교, PC 화면 구성, 모바일/반응형 화면, 초기 범위와 확장 범위.`;
