import { ChangeEvent } from "react";
import { AiPipelineStatus } from "./AiPipelineStatusPanel";
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
  /**
   * - "입력" 단계에서 파일 선택만 보여주기 위한 옵션
   * - "시작" 단계에서 AI 분석 시작 버튼만 보여주기 위한 옵션
   */
  showFileInput?: boolean;
  showAnalyzeButton?: boolean;
};

export function ProjectSpecUploadTestSection({
  selectedFile,
  selectedFileName,
  aiPipelineStatus,
  onSelectFile,
  onUploadAndAnalyze,
  showFileInput = true,
  showAnalyzeButton = true,
}: ProjectSpecUploadTestSectionProps) {
  const title = !showFileInput && showAnalyzeButton ? "AI 분석 시작" : "ProjectSpec 업로드";
  const subTitle = !showFileInput && showAnalyzeButton ? "AI가 요구사항을 분석하고 Task를 자동 생성합니다." : "파일을 업로드하면 AI가 요구사항을 분석하고 Task를 자동 생성합니다.";

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
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>{title}</h2>
      <p style={{ marginTop: 0, marginBottom: 10 }}>{subTitle}</p>
      <p style={{ marginTop: 0, marginBottom: 12 }}>
        아래에서 파일을 선택한 뒤, AI 분석 시작으로 전체 흐름을 실행합니다.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {showFileInput ? (
          <>
            <label htmlFor="projectspec-file-input" style={{ fontWeight: 600 }}>
              ProjectSpec 파일 선택
            </label>
            <input
              id="projectspec-file-input"
              type="file"
              accept=".md,.doc,.docx"
              onChange={onSelectFile}
            />
            <p style={{ margin: 0, color: "#555" }}>
              지원 형식: <code>.md</code>, <code>.doc</code>, <code>.docx</code>
            </p>
            {selectedFileName ? (
              <p style={{ margin: 0 }}>
                선택된 파일: <strong>{selectedFileName}</strong>
              </p>
            ) : (
              <p style={{ margin: 0, color: "#555" }}>아직 선택된 파일이 없습니다.</p>
            )}
          </>
        ) : null}

        {showAnalyzeButton ? (
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
        ) : null}
      </div>
    </section>
  );
}
