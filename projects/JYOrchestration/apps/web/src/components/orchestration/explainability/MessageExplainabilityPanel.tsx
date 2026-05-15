"use client";

import { useCallback, useId, useState, type CSSProperties } from "react";
import type { MessageExplainabilityViewModel } from "@/lib/harness/explainability/messageExplainabilityTypes";
import {
  messageExplainabilityRiskLabel,
  messageExplainabilityRiskTone,
} from "@/lib/overlay-ui/messageExplainabilityUiAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

export type MessageExplainabilityPanelProps = Readonly<{
  vm: MessageExplainabilityViewModel;
  defaultOpen?: boolean;
  /** 프롬프트 타임라인 드로어 등 상세 화면으로 이동(없으면 링크 미표시) */
  onOpenPromptTimeline?: () => void;
  /** 타임라인 링크를 노출할지(데이터 없으면 숨김) */
  promptTimelineAvailable?: boolean;
}>;

function riskBadgeColors(tone: OverlayUiBadgeTone): { bg: string; fg: string; border: string } {
  switch (tone) {
    case "danger":
      return { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" };
    case "warning":
      return { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" };
    case "positive":
      return { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" };
    case "info":
    default:
      return { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" };
  }
}

export function MessageExplainabilityPanel({
  vm,
  defaultOpen = false,
  onOpenPromptTimeline,
  promptTimelineAvailable = false,
}: MessageExplainabilityPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const panelId = useId();
  const tone = messageExplainabilityRiskTone(vm.riskLevel);
  const rc = riskBadgeColors(tone);

  const showTimelineLink = Boolean(onOpenPromptTimeline && promptTimelineAvailable);

  return (
    <div className="jyo-msg-explainability" style={{ marginTop: 10, width: "100%" } satisfies CSSProperties}>
      <style>{`
        @media (max-width: 720px) {
          .jyo-msg-explainability .jyo-explain-toggle-btn {
            width: 100%;
            max-width: 100%;
          }
        }
        @media (min-width: 721px) {
          .jyo-msg-explainability .jyo-explain-toggle-btn {
            width: auto;
            max-width: 100%;
            align-self: flex-end;
          }
          .jyo-msg-explainability-inner {
            align-items: flex-end;
          }
        }
      `}</style>
      <div className="jyo-msg-explainability-inner" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          className="jyo-explain-toggle-btn"
          data-testid="ai-explain-toggle"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          style={{
            border: "1px solid #d1d5db",
            background: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 800,
            color: "#374151",
            cursor: "pointer",
            textAlign: "left",
            wordBreak: "break-word",
          }}
        >
          {open ? "▾ AI 판단 보기" : "▸ AI 판단 보기"}
        </button>
        {open ? (
          <div
            id={panelId}
            role="region"
            aria-label="AI 판단 요약"
            style={{
              width: "100%",
              marginTop: 0,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fafafa",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
                rowGap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: t.textPrimary,
                  wordBreak: "break-word",
                  flex: "1 1 140px",
                  minWidth: 0,
                }}
              >
                {vm.headline}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: rc.bg,
                  color: rc.fg,
                  border: `1px solid ${rc.border}`,
                  flexShrink: 0,
                }}
              >
                {messageExplainabilityRiskLabel(vm.riskLevel)}
              </span>
              {vm.warningCount > 0 ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, flexShrink: 0 }}>
                  경고 {vm.warningCount}
                </span>
              ) : null}
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 12,
                lineHeight: 1.5,
                color: t.textPrimary,
                wordBreak: "break-word",
              }}
            >
              {vm.summaryLines.map((line, i) => (
                <li key={`${i}-${line.slice(0, 40)}`} style={{ marginBottom: 4 }}>
                  {line}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted }}>{vm.sections.length}개 영역</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {vm.sections.map((s) => (
                <div
                  key={s.type}
                  style={{
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: "#374151",
                    borderLeft: "3px solid #d1d5db",
                    paddingLeft: 8,
                    wordBreak: "break-word",
                  }}
                >
                  <span style={{ fontWeight: 800 }}>{s.title}</span>
                  <span style={{ fontWeight: 500 }}> — {s.summary}</span>
                </div>
              ))}
            </div>
            {showTimelineLink ? (
              <button
                type="button"
                data-testid="ai-explain-open-prompt-timeline"
                onClick={() => onOpenPromptTimeline?.()}
                style={{
                  alignSelf: "flex-start",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#2563eb",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                  wordBreak: "break-word",
                  textAlign: "left",
                }}
              >
                프롬프트 이력에서 자세히 보기
              </button>
            ) : null}
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: t.textMuted, wordBreak: "break-word" }}>
              {vm.disclaimer}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
