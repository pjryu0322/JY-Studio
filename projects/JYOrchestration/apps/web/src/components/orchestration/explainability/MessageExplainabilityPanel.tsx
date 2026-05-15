"use client";

import { useCallback, useId, useState, type CSSProperties, type ReactNode } from "react";
import type { MessageExplainabilityViewModel } from "@/lib/harness/explainability/messageExplainabilityTypes";
import {
  messageExplainabilityRiskLabel,
  messageExplainabilityRiskTone,
} from "@/lib/overlay-ui/messageExplainabilityUiAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

export type MessageExplainabilityPanelProps = Readonly<{
  vm: MessageExplainabilityViewModel;
  defaultOpen?: boolean;
  onOpenPromptTimeline?: () => void;
  promptTimelineAvailable?: boolean;
  /** H8.5 — 매핑 품질을 사용자 문구로만 표시(내부 confidence 키 비노출). */
  connectionQualityLabel?: string;
}>;

const MAX_SECTION_PREVIEW = 3;
const MAX_BADGE_PILLS = 3;

function overlayToneToBadgeVariant(tone: OverlayUiBadgeTone): BadgeVariant {
  switch (tone) {
    case "danger":
      return "danger";
    case "warning":
      return "warning";
    case "positive":
      return "success";
    case "info":
    default:
      return "info";
  }
}

export function MessageExplainabilityPanel({
  vm,
  defaultOpen = false,
  onOpenPromptTimeline,
  promptTimelineAvailable = false,
  connectionQualityLabel,
}: MessageExplainabilityPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const panelId = useId();
  const tone = messageExplainabilityRiskTone(vm.riskLevel);

  const showTimelineLink = Boolean(onOpenPromptTimeline && promptTimelineAvailable);

  const pills: { key: string; node: ReactNode }[] = [
    {
      key: "risk",
      node: (
        <Badge variant={overlayToneToBadgeVariant(tone)} title="이번 응답 기준 위험도(휴리스틱)">
          {messageExplainabilityRiskLabel(vm.riskLevel)}
        </Badge>
      ),
    },
  ];
  if (vm.warningCount > 0) {
    pills.push({
      key: "warn",
      node: (
        <Badge variant="neutral" title="경고 태그 수">
          경고 {vm.warningCount}
        </Badge>
      ),
    });
  }
  if (connectionQualityLabel?.trim()) {
    const full = connectionQualityLabel.trim();
    const short = full.length > 22 ? `${full.slice(0, 21)}…` : full;
    pills.push({
      key: "conn",
      node: (
        <Badge variant="info" title={full}>
          {short}
        </Badge>
      ),
    });
  }
  const displayPills = pills.slice(0, MAX_BADGE_PILLS);

  const sectionPreview = vm.sections.slice(0, MAX_SECTION_PREVIEW);
  const sectionMore = vm.sections.length - sectionPreview.length;

  return (
    <div className="jyo-msg-explainability" style={{ marginTop: 10, width: "100%" } satisfies CSSProperties}>
      <style>{`
        @media (max-width: 720px) {
          .jyo-msg-explainability .jyo-explain-toggle-btn {
            width: 100%;
            max-width: 100%;
          }
          .jyo-msg-explainability .jyo-explain-badge-row {
            width: 100%;
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
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: t.textPrimary,
                wordBreak: "break-word",
              }}
            >
              {vm.headline}
            </span>
            <div
              className="jyo-explain-badge-row"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
                rowGap: 6,
              }}
            >
              {displayPills.map((p) => (
                <span key={p.key}>{p.node}</span>
              ))}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted }}>
              {sectionPreview.length}개 영역 요약
              {sectionMore > 0 ? ` · 외 ${sectionMore}개는 타임라인에서 확인` : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sectionPreview.map((s) => (
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
