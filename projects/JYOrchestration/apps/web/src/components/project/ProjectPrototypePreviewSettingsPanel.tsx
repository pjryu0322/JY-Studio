"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import { useProjectPrototypePreview } from "@/lib/project/useProjectPrototypePreview";

export function ProjectPrototypePreviewSettingsPanel(p: { readonly projectId: string }) {
  const pp = useProjectPrototypePreview(p.projectId);

  return (
    <section
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 16,
        background: t.bgCard,
      }}
    >
      <h2 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 900, color: t.textPrimary }}>프로젝트 Preview</h2>
      <p style={{ margin: "0 0 14px 0", fontSize: 13, color: t.textSecondary, lineHeight: 1.55 }}>
        이 프로젝트의 미리보기·검토 화면에 적용됩니다. 값은 이 브라우저·프로젝트에만 저장됩니다.
      </p>
      <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 800, color: t.textMuted }}>화면 레이아웃 (뷰포트)</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {(
          [
            { id: "desktop" as const, label: "Desktop" },
            { id: "mobile" as const, label: "Mobile" },
            { id: "auto" as const, label: "Auto" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => pp.setPrototypePreviewWorkMode(opt.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: pp.prototypePreviewWorkMode === opt.id ? `2px solid ${t.accentTeal}` : `1px solid ${t.border}`,
              background: pp.prototypePreviewWorkMode === opt.id ? t.accentTealSurface : t.bgCard,
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              color: t.textPrimary,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {pp.prototypePreviewWorkMode === "mobile" ? (
        <div>
          <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 800, color: t.textMuted }}>모바일 프리셋</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              onClick={() => pp.setPrototypePreviewMobileDevice("iphone")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border:
                  pp.prototypePreviewMobileDevice === "iphone" ? `2px solid ${t.accentTeal}` : `1px solid ${t.border}`,
                background: pp.prototypePreviewMobileDevice === "iphone" ? t.accentTealSurface : t.bgCard,
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                color: t.textPrimary,
              }}
            >
              iPhone (390×844)
            </button>
            <button
              type="button"
              onClick={() => pp.setPrototypePreviewMobileDevice("android")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border:
                  pp.prototypePreviewMobileDevice === "android" ? `2px solid ${t.accentTeal}` : `1px solid ${t.border}`,
                background: pp.prototypePreviewMobileDevice === "android" ? t.accentTealSurface : t.bgCard,
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                color: t.textPrimary,
              }}
            >
              Android (360×800)
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
