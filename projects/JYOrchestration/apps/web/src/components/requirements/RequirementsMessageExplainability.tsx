"use client";

import { useCallback, useMemo, useState } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { buildMessageExplainabilityViewModel } from "@/lib/harness/explainability/buildMessageExplainabilityViewModel";
import {
  messageExplainabilityRiskLabel,
  messageExplainabilityRiskTone,
} from "@/lib/overlay-ui/messageExplainabilityUiAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

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

export function RequirementsMessageExplainability({ message }: { readonly message: RequirementsMessage }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  const vm = useMemo(
    () =>
      buildMessageExplainabilityViewModel({
        overlayExtract: message.role === "ai" ? (message.meta?.messageOverlayExplainability ?? null) : null,
      }),
    [message.role, message.meta?.messageOverlayExplainability]
  );

  if (message.role !== "ai" || !vm.hasData) return null;

  const tone = messageExplainabilityRiskTone(vm.riskLevel);
  const rc = riskBadgeColors(tone);

  return (
    <div style={{ marginTop: 10, width: "100%" }}>
      <button
        type="button"
        data-testid="ai-explain-toggle"
        onClick={toggle}
        aria-expanded={open}
        style={{
          border: "1px solid #d1d5db",
          background: "#fff",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 800,
          color: "#374151",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        {open ? "▾ AI 판단 보기" : "▸ AI 판단 보기"}
      </button>
      {open ? (
        <div
          role="region"
          aria-label="AI 판단 요약"
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fafafa",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: t.textPrimary }}>{vm.headline}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 999,
                background: rc.bg,
                color: rc.fg,
                border: `1px solid ${rc.border}`,
              }}
            >
              {messageExplainabilityRiskLabel(vm.riskLevel)}
            </span>
            {vm.warningCount > 0 ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted }}>경고 {vm.warningCount}</span>
            ) : null}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.45, color: t.textPrimary }}>
            {vm.summaryLines.map((line, i) => (
              <li key={`${i}-${line.slice(0, 32)}`} style={{ marginBottom: 4 }}>
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
                  lineHeight: 1.35,
                  color: "#374151",
                  borderLeft: "3px solid #d1d5db",
                  paddingLeft: 8,
                }}
              >
                <span style={{ fontWeight: 800 }}>{s.title}</span>
                <span style={{ fontWeight: 500 }}> — {s.summary}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.4, color: t.textMuted }}>{vm.disclaimer}</p>
        </div>
      ) : null}
    </div>
  );
}
