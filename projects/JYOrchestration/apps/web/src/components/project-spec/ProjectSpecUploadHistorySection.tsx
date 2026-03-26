import { UploadHistoryItem } from "./types";
import { formatTestedAt } from "./format";

type ProjectSpecUploadHistorySectionProps = {
  uploadHistory: UploadHistoryItem[];
};

export function ProjectSpecUploadHistorySection({
  uploadHistory,
}: ProjectSpecUploadHistorySectionProps) {
  const aiAnalysisState = (item: UploadHistoryItem): { label: string; color: string } => {
    if (item.hasParsedJson) {
      return { label: "완료", color: "#16a34a" };
    }
    const ps = String(item.parseStatus || "").toUpperCase();
    if (ps.includes("FAIL") || ps.includes("ERROR")) {
      return { label: "실패", color: "#dc2626" };
    }
    return { label: "대기", color: "#64748b" };
  };

  return (
    <div
      data-ui-label="[F-1-L-3] Legacy — upload history"
      style={{
        borderTop: "1px solid #e5e5e5",
        paddingTop: 10,
        marginTop: 12,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>최근 업로드 이력</h3>
      <p style={{ margin: "0 0 8px 0", color: "#555" }}>
        AI 분석 진행/결과 상태를 보여줍니다.
      </p>
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
                <strong>참고 파일:</strong> {item.originalFileName}
              </p>
              <p style={{ margin: "0 0 4px 0" }}>
                <strong>AI 분석 상태:</strong>{" "}
                <span style={{ color: aiAnalysisState(item).color, fontWeight: 800 }}>
                  {aiAnalysisState(item).label}
                </span>
              </p>
              <p style={{ margin: 0 }}>
                <strong>완료 시각:</strong> {item.parsedAt ? formatTestedAt(item.parsedAt) : "-"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
