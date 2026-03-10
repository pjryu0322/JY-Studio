"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useJobStore } from "@/store/jobStore";

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.md,.hwp,.hwpx";

interface UploadResponse {
  jobId?: string;
  error?: string;
}

type QueueStatus = "queued" | "uploading" | "processing" | "done" | "failed";

interface UploadQueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  message?: string;
}

export default function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { refresh, setSelectedJobId } = useJobStore();
  const processingRef = useRef(false);
  const queueRef = useRef<UploadQueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const queuedCount = useMemo(
    () => queue.filter((item) => item.status === "queued").length,
    [queue]
  );

  const updateQueueItem = (
    id: string,
    patch: Partial<Pick<UploadQueueItem, "status" | "progress" | "message">>
  ) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const uploadOne = async (item: UploadQueueItem) => {
    updateQueueItem(item.id, { status: "uploading", progress: 15, message: "업로드 중..." });
    const formData = new FormData();
    formData.append("file", item.file);
    const res = await fetch("/api/jobs", { method: "POST", body: formData });
    const payload = (await res.json().catch(() => ({}))) as UploadResponse;
    if (!res.ok) {
      throw new Error(payload.error ?? `Upload failed (${res.status})`);
    }
    updateQueueItem(item.id, { status: "processing", progress: 80, message: "추출/청킹 파이프라인 등록 완료" });
    if (payload.jobId) setSelectedJobId(payload.jobId);
    await refresh();
    updateQueueItem(item.id, { status: "done", progress: 100, message: "완료" });
  };

  const processQueue = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (true) {
        const next = queueRef.current.find((item) => item.status === "queued");
        if (!next) break;
        try {
          await uploadOne(next);
        } catch (e) {
          updateQueueItem(next.id, {
            status: "failed",
            progress: 100,
            message: e instanceof Error ? e.message : "Upload failed",
          });
          setError(e instanceof Error ? e.message : "Upload failed");
        }
      }
    } finally {
      processingRef.current = false;
    }
  };

  const enqueueFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);
    const newItems = list.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      status: "queued" as const,
      progress: 0,
      message: "대기 중",
    }));
    setQueue((prev) => [...newItems, ...prev].slice(0, 20));
    setTimeout(() => {
      void processQueue();
    }, 0);
  };

  return (
    <section style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
        Ingestion Panel (Drag & Drop / Multi-file)
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
        >
          파일 선택
        </button>
        <span style={{ fontSize: 12, color: "#666" }}>
          .pdf / .doc / .docx / .ppt / .pptx / .md / .hwp / .hwpx
        </span>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          enqueueFiles(e.dataTransfer.files);
        }}
        style={{
          marginTop: 10,
          border: `1px dashed ${dragOver ? "#1565c0" : "#bbb"}`,
          borderRadius: 8,
          padding: 10,
          background: dragOver ? "#e3f2fd" : "#fafafa",
          fontSize: 12,
          color: "#555",
        }}
      >
        여기에 파일을 드롭하면 순차적으로 업로드/처리됩니다.
      </div>
      {queue.length > 0 && (
        <div style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 6, color: "#444" }}>
            파일 큐: {queue.length}개 (대기 {queuedCount})
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" }}>
            {queue.map((item) => (
              <div key={item.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#333",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={item.file.name}
                  >
                    {item.file.name}
                  </span>
                  <span style={{ fontSize: 11, color: "#666" }}>{item.status}</span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 6,
                    borderRadius: 999,
                    background: "#eceff1",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${item.progress}%`,
                      height: "100%",
                      background:
                        item.status === "failed"
                          ? "#ef5350"
                          : item.status === "done"
                            ? "#66bb6a"
                            : "#42a5f5",
                    }}
                  />
                </div>
                {item.message && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#666" }}>{item.message}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#c62828" }}>{error}</div>
      )}
    </section>
  );
}

