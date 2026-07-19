export const RETRIEVAL_REJECTION_REASONS = [
  "질문과 관련성이 낮음",
  "동일 결과가 중복됨",
  "필요한 내용이 검색되지 않음",
  "출처·페이지가 부정확함",
  "다른 문서 내용이 섞임",
  "기타",
] as const;

export const DOWNLOAD_REJECTION_REASONS = [
  "필수 파일 누락",
  "Chunk 데이터 이상",
  "출처 추적 정보 부족",
  "Checksum 불일치",
  "Manifest 정보 오류",
  "라이선스·이용조건 오류",
  "기타",
] as const;

export type RetrievalRejectionReason = (typeof RETRIEVAL_REJECTION_REASONS)[number];
export type DownloadRejectionReason = (typeof DOWNLOAD_REJECTION_REASONS)[number];
