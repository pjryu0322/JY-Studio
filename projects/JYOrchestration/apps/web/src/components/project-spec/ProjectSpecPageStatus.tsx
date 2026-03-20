type ProjectSpecPageStatusProps = {
  loading: boolean;
  errorMessage: string | null;
};

export function ProjectSpecPageStatus({
  loading,
  errorMessage,
}: ProjectSpecPageStatusProps) {
  return (
    <>
      {loading ? (
        <p style={{ marginBottom: 16 }}>프로젝트 정보를 불러오는 중...</p>
      ) : null}
      {errorMessage ? (
        <p style={{ marginBottom: 16, color: "#b00020" }}>{errorMessage}</p>
      ) : null}
    </>
  );
}
