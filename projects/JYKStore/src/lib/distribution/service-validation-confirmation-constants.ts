export const RETRIEVAL_REJECTION_REASONS = [
  "질문과 관련 없는 결과",
  "내용이 원문과 다름",
  "출처 또는 페이지가 잘못됨",
  "다른 문서 내용이 섞임",
  "검색 결과가 불충분함",
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
