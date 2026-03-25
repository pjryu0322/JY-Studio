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
      data-ui-label="[F-1-4] Function — ProjectSpec File Upload"
      style={{
        border: "1px dashed #bbb",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>ProjectSpec 업로드 (다음 단계)</h2>
      <p style={{ marginTop: 0, marginBottom: 10 }}>
        `.md`는 원문 텍스트 저장을 시도하고, `.doc/.docx`는 현재 메타데이터 중심으로 등록합니다.
      </p>
      <p style={{ marginTop: 0, marginBottom: 12 }}>
        실제 문서 파싱/정책 생성은 다음 단계에서 추가될 예정입니다.
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
              <strong>originalFileName:</strong> {uploadResult.originalFileName}
            </p>
            <p style={{ margin: 0, marginBottom: 4 }}>
              <strong>fileSize:</strong> {uploadResult.fileSize}
            </p>
            <p style={{ margin: 0, marginBottom: 4 }}>
              <strong>fileType:</strong> {uploadResult.fileType || "unknown"}
            </p>
            <p style={{ margin: 0, marginTop: 4 }}>
              <strong>sourceType:</strong> {uploadResult.sourceType}
            </p>
            <p style={{ margin: 0, marginTop: 4 }}>
              <strong>contentStored:</strong> {uploadResult.contentStored ? "true" : "false"}
            </p>
            <p style={{ margin: 0, marginTop: 4 }}>
              <strong>parseStatus:</strong> {uploadResult.parseStatus || "PENDING"}
            </p>
            <p style={{ margin: 0, marginTop: 4 }}>
              <strong>parsedAt:</strong> {uploadResult.parsedAt ? formatTestedAt(uploadResult.parsedAt) : "-"}
            </p>
            <p style={{ margin: 0, marginTop: 4 }}>
              <strong>parsedJson:</strong> {uploadResult.hasParsedJson ? "JSON 생성됨" : "미생성"}
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
