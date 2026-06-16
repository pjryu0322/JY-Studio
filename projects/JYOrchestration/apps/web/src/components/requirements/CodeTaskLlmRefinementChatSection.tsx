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

function DiagnosticsLinesList(input: {
  readonly lines: readonly string[];
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
    <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none" }}>
      {input.lines.map((line) => {
        const showCopy = isCodeTaskTotalCountSummaryLine(line) && Boolean(input.onCopyAllCodeTaskPrompts);
        return (
          <li
            key={line}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              lineHeight: 1.45,
              color: "#64748b",
              margin: "2px 0",
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
                }}
              >
                <CopyIcon />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function ImplementationPreparationDiagnosticsCollapsible(input: {
  readonly diagnosticsText: string;
  readonly onCopyAllCodeTaskPrompts?: () => Promise<boolean>;
}) {
  const body = String(input.diagnosticsText ?? "").trim();
  if (!body) return null;
  const lines = body.split("\n").map((l) => l.trimEnd()).filter((l) => l.length > 0);

  return (
    <details
      style={{
        marginTop: 10,
        fontSize: 12,
        color: "#64748b",
        borderTop: "1px solid #e2e8f0",
        paddingTop: 8,
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 700, color: "#475569", userSelect: "none" }}>
        실행 진단 정보
      </summary>
      <DiagnosticsLinesList lines={lines} onCopyAllCodeTaskPrompts={input.onCopyAllCodeTaskPrompts} />
    </details>
  );
}

/** @deprecated Prefer ImplementationPreparationDiagnosticsCollapsible */
export function CodeTaskLlmRefinementChatSection(input: {
  readonly parts: CodeTaskLlmRefinementChatBlockParts;
  readonly onCopyAllCodeTaskPrompts?: () => Promise<boolean>;
}) {
  const body = [input.parts.title, ...input.parts.lines].join("\n");
  return (
    <ImplementationPreparationDiagnosticsCollapsible
      diagnosticsText={body}
      onCopyAllCodeTaskPrompts={input.onCopyAllCodeTaskPrompts}
    />
  );
}

export function RequirementsAiMessageWithOptionalCodeTaskCopy(input: {
  readonly text: string;
  readonly variant?: "default" | "error";
  readonly enableCodeTaskPromptBulkCopy?: boolean;
  readonly onCopyAllCodeTaskPrompts?: () => Promise<boolean>;
  readonly implementationPreparationDiagnosticsText?: string | null;
}) {
  const legacyParts = splitMessageContentForCodeTaskLlmRefinementBlock(input.text);

  const diagnosticsText =
    input.implementationPreparationDiagnosticsText?.trim() ||
    (legacyParts ? [legacyParts.title, ...legacyParts.lines].join("\n") : "");

  const displayText = legacyParts
    ? [legacyParts.prefix, legacyParts.suffix].filter((s) => s.trim().length > 0).join("\n\n")
    : input.text;

  const variant = input.variant ?? "default";

  return (
    <>
      <RequirementsAiMessageMarkdown text={displayText} variant={variant} />
      {diagnosticsText ? (
        <ImplementationPreparationDiagnosticsCollapsible
          diagnosticsText={diagnosticsText}
          onCopyAllCodeTaskPrompts={
            input.enableCodeTaskPromptBulkCopy ? input.onCopyAllCodeTaskPrompts : undefined
          }
        />
      ) : null}
    </>
  );
}
