import { UploadHistoryItem } from "./types";

type ProjectSpecUploadHistorySectionProps = {
  uploadHistory: UploadHistoryItem[];
};

export function ProjectSpecUploadHistorySection({
  uploadHistory,
}: ProjectSpecUploadHistorySectionProps) {
  return (
    <div
      style={{
        borderTop: "1px solid #e5e5e5",
        paddingTop: 10,
        marginTop: 12,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>
        최근 업로드 테스트 결과
      </h3>
      <p style={{ margin: "0 0 8px 0", color: "#555" }}>
        현재 세션에서 실행한 업로드 테스트 결과입니다.
      </p>
      {uploadHistory.length === 0 ? (
        <p style={{ margin: 0, color: "#555" }}>아직 업로드 테스트 이력이 없습니다.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {uploadHistory.map((item, index) => (
            <div
              key={`${item.fileName}-${item.testedAt}-${index}`}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                padding: 10,
                background: "#fff",
              }}
            >
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>fileName:</strong> {item.fileName}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>fileSize:</strong> {item.fileSize}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>fileType:</strong> {item.fileType || "unknown"}
              </p>
              <p style={{ margin: 0 }}>
                <strong>testedAt:</strong> {item.testedAt}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
