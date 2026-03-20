import { UploadHistoryItem } from "./types";
import { formatTestedAt } from "./format";

type ProjectSpecUploadHistorySectionProps = {
  uploadHistory: UploadHistoryItem[];
  parsingUploadId: string | null;
  generatingTaskUploadId: string | null;
  parseMessage: string | null;
  taskMessage: string | null;
  onParse: (uploadId: string) => void;
  onGenerateTasks: (uploadId: string) => void;
};

export function ProjectSpecUploadHistorySection({
  uploadHistory,
  parsingUploadId,
  generatingTaskUploadId,
  parseMessage,
  taskMessage,
  onParse,
  onGenerateTasks,
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
        최근 메타데이터 등록 결과
      </h3>
      <p style={{ margin: "0 0 8px 0", color: "#555" }}>
        DB에 등록된 최근 ProjectSpec 업로드 메타데이터입니다.
      </p>
      {parseMessage ? (
        <p style={{ margin: "0 0 8px 0", color: "#333" }}>{parseMessage}</p>
      ) : null}
      {taskMessage ? <p style={{ margin: "0 0 8px 0", color: "#333" }}>{taskMessage}</p> : null}
      {uploadHistory.length === 0 ? (
        <p style={{ margin: 0, color: "#555" }}>아직 등록된 업로드 메타데이터가 없습니다.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {uploadHistory.map((item, index) => (
            <div
              key={`${item.id}-${item.createdAt}-${index}`}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                padding: 10,
                background: "#fff",
              }}
            >
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>originalFileName:</strong> {item.originalFileName}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>fileSize:</strong> {item.fileSize}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>fileType:</strong> {item.fileType || "unknown"}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>sourceType:</strong> {item.sourceType}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>contentStored:</strong> {item.contentStored ? "true" : "false"}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>parseStatus:</strong> {item.parseStatus || "PENDING"}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>parsedAt:</strong> {item.parsedAt ? formatTestedAt(item.parsedAt) : "-"}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>parsedJson:</strong> {item.hasParsedJson ? "JSON 생성됨" : "미생성"}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>status:</strong> {item.status}
              </p>
              <p style={{ margin: 0 }}>
                <strong>createdAt:</strong> {formatTestedAt(item.createdAt)}
              </p>
              <button
                type="button"
                onClick={() => onParse(item.id)}
                disabled={parsingUploadId === item.id}
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: parsingUploadId === item.id ? "not-allowed" : "pointer",
                  opacity: parsingUploadId === item.id ? 0.7 : 1,
                }}
              >
                {parsingUploadId === item.id ? "파싱 실행 중..." : "파싱 실행"}
              </button>
              <button
                type="button"
                onClick={() => onGenerateTasks(item.id)}
                disabled={generatingTaskUploadId === item.id || item.parseStatus !== "SUCCESS"}
                style={{
                  marginTop: 8,
                  marginLeft: 8,
                  padding: "6px 10px",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  background: "#fff",
                  cursor:
                    generatingTaskUploadId === item.id || item.parseStatus !== "SUCCESS"
                      ? "not-allowed"
                      : "pointer",
                  opacity: generatingTaskUploadId === item.id || item.parseStatus !== "SUCCESS" ? 0.7 : 1,
                }}
              >
                {generatingTaskUploadId === item.id ? "Task 생성 중..." : "Task 생성"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
