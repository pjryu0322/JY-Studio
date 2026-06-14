"use client";

import type { ReactNode } from "react";
import type { ImplementationComposerAttachment } from "@/lib/preview/implementationComposerAttachmentTypes";

function previewUrlLabel(previewUrl: string): string {
  const trimmed = previewUrl.trim();
  if (trimmed.length <= 48) return trimmed;
  try {
    const u = new URL(trimmed);
    return `${u.host}${u.pathname}`.slice(0, 48);
  } catch {
    return `${trimmed.slice(0, 45)}…`;
  }
}

export function ImplementationComposerAttachmentBar(props: {
  readonly attachments: readonly ImplementationComposerAttachment[];
  readonly onRemove: (attachmentId: string) => void;
}): ReactNode {
  if (!props.attachments.length) return null;

  return (
    <div
      data-testid="implementation-composer-attachment-bar"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "0 0 10px",
        width: "100%",
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "#64748b", fontWeight: 600 }}>
        Preview 캡처 {props.attachments.length}개가 첨부되었습니다. 보완 내용을 입력한 뒤 전송해 주세요.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {props.attachments.map((attachment) => {
          if (attachment.type !== "preview_region_capture") return null;
          const thumb = attachment.imageDataUrl ?? attachment.imageUrl ?? "";
          return (
            <div
              key={attachment.id}
              data-testid={`implementation-composer-attachment-${attachment.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                maxWidth: "100%",
              }}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt="Preview 캡처 썸네일"
                  style={{
                    width: 56,
                    height: 40,
                    objectFit: "cover",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Preview 영역 캡처</div>
                <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {previewUrlLabel(attachment.previewUrl)}
                </div>
              </div>
              <button
                type="button"
                aria-label="첨부 제거"
                data-testid={`implementation-composer-attachment-remove-${attachment.id}`}
                onClick={() => props.onRemove(attachment.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                  color: "#64748b",
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
