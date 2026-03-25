import { ChangeEvent } from "react";
import { AiPipelineStatus } from "./AiPipelineStatusPanel";
import { formatTestedAt } from "./format";
import { UploadResult, UploadStatus } from "./types";

type ProjectSpecUploadTestSectionProps = {
  selectedFile: File | null;
  selectedFileName: string | null;
  uploadMessage: string | null;
  uploadResult: UploadResult | null;
  uploadStatus: UploadStatus;
  aiPipelineStatus: AiPipelineStatus;
  onSelectFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onUploadAndAnalyze: () => void;
};

export function ProjectSpecUploadTestSection({
  selectedFile,
  selectedFileName,
  uploadMessage,
  uploadResult,
  uploadStatus,
  aiPipelineStatus,
  onSelectFile,
  onUploadAndAnalyze,
}: ProjectSpecUploadTestSectionProps) {
  const analyzingBusy =
    aiPipelineStatus === "uploading" ||
    aiPipelineStatus === "analyzing" ||
    aiPipelineStatus === "generating_tasks";

  return (
    <section
      data-ui-label="[F-1-4] Function — ProjectSpec File Upload"
      style={{
        border: "1px dashed #bbb",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>ProjectSpec 업로드</h2>
      <p style={{ marginTop: 0, marginBottom: 10 }}>
        파일을 업로드하면 AI가 요구사항을 분석하고 Task를 자동 생성합니다.
      </p>
      <p style={{ marginTop: 0, marginBottom: 12 }}>아래의 한 번의 버튼으로 전체 흐름이 실행됩니다.</p>

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
          data-testid="project-spec-ai-analyze-start"
          onClick={onUploadAndAnalyze}
          disabled={analyzingBusy || !selectedFile}
          style={{
            width: "fit-content",
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: analyzingBusy || !selectedFile ? "not-allowed" : "pointer",
            opacity: analyzingBusy || !selectedFile ? 0.7 : 1,
          }}
        >
          AI 분석 시작
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
            <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>AI 분석 시작 실패</p>
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
            <p style={{ margin: 0, fontWeight: 600, marginBottom: 6 }}>업로드 완료</p>
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
