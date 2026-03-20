import { ChangeEvent } from "react";
import { formatTestedAt } from "./format";
import { UploadResult, UploadStatus } from "./types";

type ProjectSpecUploadTestSectionProps = {
  selectedFile: File | null;
  selectedFileName: string | null;
  uploadMessage: string | null;
  uploadResult: UploadResult | null;
  uploadStatus: UploadStatus;
  uploading: boolean;
  onSelectFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onUploadTest: () => void;
};

export function ProjectSpecUploadTestSection({
  selectedFile,
  selectedFileName,
  uploadMessage,
  uploadResult,
  uploadStatus,
  uploading,
  onSelectFile,
  onUploadTest,
}: ProjectSpecUploadTestSectionProps) {
  return (
    <section
      style={{
        border: "1px dashed #bbb",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>ProjectSpec 업로드 (다음 단계)</h2>
      <p style={{ marginTop: 0, marginBottom: 10 }}>
        ProjectSpec은 Markdown/DOCX 중심으로 다룰 예정이며, 다음 단계에서 업로드 API와 파싱 기능이
        추가될 예정입니다.
      </p>
      <p style={{ marginTop: 0, marginBottom: 12 }}>
        현재 단계에서는 파일 본문 저장/파싱 없이 메타데이터만 DB에 등록합니다.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        <label htmlFor="projectspec-file-input" style={{ fontWeight: 600 }}>
          ProjectSpec 파일 선택 (UI 뼈대)
        </label>
        <input
          id="projectspec-file-input"
          type="file"
          accept=".md,.doc,.docx"
          onChange={onSelectFile}
        />
        <p style={{ margin: 0, color: "#555" }}>
          지원 예정 형식: <code>.md</code>, <code>.doc</code>, <code>.docx</code>
        </p>
        <button
          type="button"
          onClick={onUploadTest}
          disabled={uploading || !selectedFile}
          style={{
            width: "fit-content",
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: uploading || !selectedFile ? "not-allowed" : "pointer",
            opacity: uploading || !selectedFile ? 0.7 : 1,
          }}
        >
          {uploading ? "업로드 테스트 중..." : "업로드 테스트"}
        </button>
        {selectedFileName ? (
          <p style={{ margin: 0 }}>
            선택된 파일: <strong>{selectedFileName}</strong>
          </p>
        ) : (
          <p style={{ margin: 0, color: "#555" }}>아직 선택된 파일이 없습니다.</p>
        )}
        {uploadStatus === "error" && uploadMessage ? (
          <div
            style={{
              border: "1px solid #f5c2c7",
              borderRadius: 8,
              padding: 10,
              background: "#fff5f5",
              color: "#b00020",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>업로드 테스트 실패</p>
            <p style={{ margin: 0 }}>{uploadMessage}</p>
          </div>
        ) : null}
        {uploadStatus === "success" && uploadResult ? (
          <div
            style={{
              border: "1px solid #cfe8d2",
              borderRadius: 8,
              padding: 10,
              background: "#f3fbf4",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, marginBottom: 6 }}>업로드 테스트 결과</p>
            <p style={{ margin: 0, marginBottom: 4 }}>
              <strong>message:</strong> {uploadMessage || "업로드 API 뼈대가 정상 동작했습니다."}
            </p>
            <p style={{ margin: 0, marginBottom: 4 }}>
              <strong>fileName:</strong> {uploadResult.fileName}
            </p>
            <p style={{ margin: 0, marginBottom: 4 }}>
              <strong>fileSize:</strong> {uploadResult.fileSize}
            </p>
            <p style={{ margin: 0 }}>
              <strong>fileType:</strong> {uploadResult.fileType || "unknown"}
            </p>
            <p style={{ margin: 0, marginTop: 4 }}>
              <strong>status:</strong> {uploadResult.status}
            </p>
            <p style={{ margin: 0, marginTop: 4 }}>
              <strong>createdAt:</strong> {formatTestedAt(uploadResult.createdAt)}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
