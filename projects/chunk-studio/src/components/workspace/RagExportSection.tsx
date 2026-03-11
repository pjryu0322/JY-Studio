"use client";

interface RagExportSectionProps {
  exportFormat: "json" | "jsonl" | "csv";
  isExporting: boolean;
  exportError: string | null;
  onChangeFormat: (format: "json" | "jsonl" | "csv") => void;
  onExport: () => void;
  disabled: boolean;
}

export default function RagExportSection({
  exportFormat,
  isExporting,
  exportError,
  onChangeFormat,
  onExport,
  disabled,
}: RagExportSectionProps) {
  return (
    <section
      style={{
        margin: "10px 16px 14px",
        border: "1px solid #dfe5f0",
        borderRadius: 10,
        background: "#fff",
        padding: 10,
      }}
    >
      <strong style={{ fontSize: 12, color: "#0f172a" }}>RAG 데이터셋 내보내기</strong>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <select
          aria-label="RAG export format"
          value={exportFormat}
          onChange={(e) => onChangeFormat(e.target.value as "json" | "jsonl" | "csv")}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            padding: "4px 6px",
            fontSize: 12,
            background: "#fff",
          }}
        >
          <option value="json">JSON</option>
          <option value="jsonl">JSONL</option>
          <option value="csv">CSV</option>
        </select>
        <button
          type="button"
          onClick={onExport}
          disabled={disabled}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 7,
            background: "#fff",
            color: "#334155",
            fontSize: 12,
            padding: "4px 9px",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {isExporting ? "내보내는 중..." : "RAG 데이터셋 다운로드"}
        </button>
      </div>
      {exportError && <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 11 }}>{exportError}</div>}
    </section>
  );
}
