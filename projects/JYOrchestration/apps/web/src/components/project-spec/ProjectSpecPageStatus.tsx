type ProjectSpecPageStatusProps = {
  loading: boolean;
  errorMessage: string | null;
};

export function ProjectSpecPageStatus({
  loading,
  errorMessage,
}: ProjectSpecPageStatusProps) {
  return (
    <div data-ui-label="[P-1-4] Status Gate — Load & Error Surface">
      {loading ? (
        <p data-ui-label="[P-1-4-1] Status — Loading" style={{ marginBottom: 16 }}>
          프로젝트 정보를 불러오는 중...
        </p>
      ) : null}
      {errorMessage ? (
        <p data-ui-label="[P-1-4-2] Status — Error" style={{ marginBottom: 16, color: "#b00020" }}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
