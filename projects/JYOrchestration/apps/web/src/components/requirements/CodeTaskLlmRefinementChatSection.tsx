"use client";

import { useCallback, useState } from "react";
import {
  isCodeTaskTotalCountSummaryLine,
  splitMessageContentForCodeTaskLlmRefinementBlock,
  type CodeTaskLlmRefinementChatBlockParts,
} from "@/lib/requirements/codeTaskLlmRefinementChatBlock";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";

function CopyIcon({ size = 14 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CodeTaskLlmRefinementChatSection(input: {
  readonly parts: CodeTaskLlmRefinementChatBlockParts;
  readonly onCopyAllCodeTaskPrompts?: () => Promise<boolean>;
}) {
  const [copyBusy, setCopyBusy] = useState(false);

  const handleCopyAll = useCallback(async () => {
    if (!input.onCopyAllCodeTaskPrompts || copyBusy) return;
    setCopyBusy(true);
    try {
      await input.onCopyAllCodeTaskPrompts();
    } finally {
      setCopyBusy(false);
    }
  }, [copyBusy, input.onCopyAllCodeTaskPrompts]);

  return (
    <div style={{ margin: "8px 0" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>{input.parts.title}</div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
        {input.parts.lines.map((line) => {
          const showCopy = isCodeTaskTotalCountSummaryLine(line) && Boolean(input.onCopyAllCodeTaskPrompts);
          return (
            <li
              key={line}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                lineHeight: 1.5,
                color: "#334155",
                marginBottom: 2,
              }}
            >
              <span style={{ flex: "1 1 auto", minWidth: 0 }}>{line}</span>
              {showCopy ? (
                <button
                  type="button"
                  aria-label="CodeTask 1단계 프롬프트 초안 복사"
                  title="CodeTask 1단계 프롬프트 초안 복사"
                  disabled={copyBusy}
                  onClick={() => void handleCopyAll()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#fff",
                    color: "#1e40af",
                    cursor: copyBusy ? "wait" : "pointer",
                    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <CopyIcon />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RequirementsAiMessageWithOptionalCodeTaskCopy(input: {
  readonly text: string;
  readonly variant?: "default" | "error";
  readonly enableCodeTaskPromptBulkCopy?: boolean;
  readonly onCopyAllCodeTaskPrompts?: () => Promise<boolean>;
}) {
  const parts =
    input.enableCodeTaskPromptBulkCopy && input.onCopyAllCodeTaskPrompts
      ? splitMessageContentForCodeTaskLlmRefinementBlock(input.text)
      : null;

  if (!parts) {
    return <RequirementsAiMessageMarkdown text={input.text} variant={input.variant ?? "default"} />;
  }

  const variant = input.variant ?? "default";
  return (
    <>
      {parts.prefix ? <RequirementsAiMessageMarkdown text={parts.prefix} variant={variant} /> : null}
      <CodeTaskLlmRefinementChatSection
        parts={parts}
        onCopyAllCodeTaskPrompts={input.onCopyAllCodeTaskPrompts}
      />
      {parts.suffix ? <RequirementsAiMessageMarkdown text={parts.suffix} variant={variant} /> : null}
    </>
  );
}
