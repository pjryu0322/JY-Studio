export const RETRIEVAL_REJECTION_REASONS = [
  "질문과 관련성이 낮음",
  "동일 결과가 중복됨",
  "필요한 내용이 검색되지 않음",
  "출처·페이지가 부정확함",
  "다른 문서 내용이 섞임",
  "기타",
] as const;

export const DOWNLOAD_REJECTION_REASONS = [
  "파일명이 올바르지 않음",
  "테스트 다운로드 실패",
  "원본문서와 일치하지 않음",
  "기타",
] as const;

export type RetrievalRejectionReason = (typeof RETRIEVAL_REJECTION_REASONS)[number];
export type DownloadRejectionReason = (typeof DOWNLOAD_REJECTION_REASONS)[number];
