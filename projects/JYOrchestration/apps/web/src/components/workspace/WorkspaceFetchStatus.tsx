"use client";

type WorkspaceFetchStatusProps = {
  loadError: string | null;
  /** 데이터가 아직 없을 때만 로딩 문구를 표시합니다(백그라운드 갱신과 구분). */
  loadingWithoutData: boolean;
  loadingLabel?: string;
};

/**
 * 프로젝트 스코프 워크스페이스에서 반복되는 로드 오류·초기 로딩 문구.
 */
export function WorkspaceFetchStatus({
  loadError,
  loadingWithoutData,
  loadingLabel = "불러오는 중…",
}: WorkspaceFetchStatusProps) {
  return (
    <>
      {loadError ? (
        <p style={{ color: "#b91c1c", marginBottom: 12 }} role="alert">
          {loadError}
        </p>
      ) : null}
      {loadingWithoutData ? <p style={{ color: "#64748b" }}>{loadingLabel}</p> : null}
    </>
  );
}
