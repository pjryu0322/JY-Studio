"use client";

import { useMemo, useState } from "react";

type ProjectSpecPromptSectionProps = {
  prompt: string;
};

export function ProjectSpecPromptSection({ prompt }: ProjectSpecPromptSectionProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortPrompt = useMemo(() => {
    const trimmed = prompt.trim();
    return trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;
  }, [prompt]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      data-ui-label="[F-1-3] Function — Project Spec Prompt Guide"
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>Project Spec Prompt Guide</h2>
      <p style={{ marginBottom: 10, color: "#475569", lineHeight: 1.5, fontSize: 13 }}>
        아래 버튼을 눌러 프롬프트를 복사하거나, 필요하면 모달에서 내용을 확인할 수 있습니다.
      </p>

      {!open ? (
        <button
          type="button"
          data-testid="project-spec-prompt-guide-open"
          onClick={() => setOpen(true)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Project Spec Prompt Guide
        </button>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              data-testid="project-spec-prompt-guide-copy"
              onClick={() => void handleCopy()}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {copied ? "복사됨" : "프롬프트 복사"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                background: "#fafafa",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              닫기
            </button>
          </div>

          <div
            data-testid="project-spec-prompt-guide-content"
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              padding: 14,
              background: "#f7f7f7",
            }}
          >
            <pre
              style={{
                whiteSpace: "pre-wrap",
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {prompt}
            </pre>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            미리보기: {shortPrompt}
          </p>
        </div>
      )}
    </section>
  );
}
