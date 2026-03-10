"use client";

import { useRef, useState } from "react";
import { useChunkStore } from "@/store/chunkStore";

const accept = ".pdf,.doc,.docx,.ppt,.pptx,.md,.hwp,.hwpx";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

async function readTextFile(file: File): Promise<string> {
  return await file.text();
}

interface UploadResponse {
  jobId?: string;
  error?: string;
}

interface JobDetailResponse {
  status?: string;
  extractedText?: string;
  message?: string | null;
  errorDetail?: string | null;
}

export default function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const setInputText = useChunkStore((s) => s.setInputText);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadExtractedTextViaApi = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const createRes = await fetch("/api/jobs", { method: "POST", body: formData });
    const createPayload = (await createRes.json().catch(() => ({}))) as UploadResponse;
    if (!createRes.ok || !createPayload.jobId) {
      throw new Error(createPayload.error ?? "업로드 실패");
    }

    for (let i = 0; i < 45; i += 1) {
      const detailRes = await fetch(`/api/jobs/${createPayload.jobId}`);
      const detail = (await detailRes.json().catch(() => ({}))) as JobDetailResponse;
      if (detail.status === "DONE") {
        return (detail.extractedText ?? "").trim();
      }
      if (detail.status === "FAILED") {
        throw new Error(detail.errorDetail ?? detail.message ?? "문서 처리 실패");
      }
      if (detail.status === "ACTION_REQUIRED") {
        throw new Error("HWP/HWPX는 지원하지 않습니다. PDF로 변환 후 업로드해주세요.");
      }
      await sleep(700);
    }

    throw new Error("문서 처리 시간이 초과되었습니다. /jobs 화면에서 상태를 확인해주세요.");
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const ext = getExt(file.name);
    setLoading(true);
    setMessage(null);
    try {
      if (ext === "txt" || ext === "md") {
        const text = await readTextFile(file);
        setInputText(text);
        setMessage("텍스트 파일을 불러왔습니다.");
        return;
      }
      if (
        ext === "pdf" ||
        ext === "doc" ||
        ext === "docx" ||
        ext === "hwp" ||
        ext === "hwpx" ||
        ext === "ppt" ||
        ext === "pptx"
      ) {
        setMessage(
          ext === "pdf"
            ? "PDF를 서버에서 추출 중입니다..."
            : ext === "hwp" || ext === "hwpx"
              ? "HWP/HWPX 업로드 검증 중입니다..."
            : ext === "ppt" || ext === "pptx"
              ? "PPT/PPTX를 서버에서 추출 중입니다..."
              : "DOC/DOCX를 서버에서 추출 중입니다..."
        );
        const extracted = await loadExtractedTextViaApi(file);
        if (!extracted) {
          throw new Error("추출된 텍스트가 비어 있습니다.");
        }
        setInputText(extracted);
        setMessage(
          ext === "pdf"
            ? "PDF 텍스트 추출 완료."
            : ext === "ppt" || ext === "pptx"
              ? "PPT/PPTX 텍스트 추출 완료."
              : "DOC/DOCX 텍스트 추출 완료."
        );
        return;
      }
      setMessage("지원 형식: .pdf, .doc, .docx, .ppt, .pptx, .md, .hwp, .hwpx");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "파일 처리 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: "none" }}
        aria-label="Upload .pdf, .doc, .docx, .ppt, .pptx, .md, .hwp or .hwpx file"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        style={{
          padding: "6px 10px",
          fontSize: 12,
          cursor: "pointer",
          width: "100%",
        }}
      >
        {loading
          ? "Processing..."
          : "Choose .pdf / .doc / .docx / .ppt / .pptx / .md / .hwp / .hwpx"}
      </button>
      {message && (
        <div style={{ marginTop: 6, fontSize: 11, color: message.includes("실패") ? "#c62828" : "#555" }}>
          {message}
        </div>
      )}
    </div>
  );
}
