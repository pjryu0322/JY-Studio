"use client";

import { Button, uiTokens as t } from "@/components/ui";
import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";

export function MessengerChatRoomProjectDraftModal(p: {
  readonly open: boolean;
  readonly payload: ProjectFromChatDraftPayloadV1 | null;
  readonly projectName: string;
  readonly projectDesc: string;
  readonly confirmBusy: boolean;
  readonly onProjectNameChange: (v: string) => void;
  readonly onProjectDescChange: (v: string) => void;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  if (!p.open || !p.payload) return null;

  return (
    <div
      role="dialog"
      aria-label="프로젝트 초안"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: t.overlayScrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={() => {
        if (!p.confirmBusy) p.onClose();
      }}
    >
      <div
        style={{
          width: "min(96vw, 560px)",
          maxHeight: "min(88vh, 720px)",
          overflowY: "auto",
          borderRadius: t.radiusLg,
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          padding: 16,
          boxSizing: "border-box",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary }}>프로젝트 초안</div>
        <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, margin: "10px 0 14px" }}>
          제목 후보: {p.payload.titleCandidates.join(" · ")}
        </p>
        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: t.textMuted, marginBottom: 6 }}>프로젝트 이름</label>
        <input
          value={p.projectName}
          onChange={(e) => p.onProjectNameChange(e.target.value)}
          style={{
            width: "100%",
            marginBottom: 12,
            padding: 10,
            borderRadius: t.radiusMd,
            border: `1px solid ${t.borderStrong}`,
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: t.textMuted, marginBottom: 6 }}>설명</label>
        <textarea
          value={p.projectDesc}
          onChange={(e) => p.onProjectDescChange(e.target.value)}
          rows={5}
          style={{
            width: "100%",
            marginBottom: 14,
            padding: 10,
            borderRadius: t.radiusMd,
            border: `1px solid ${t.borderStrong}`,
            fontSize: 13,
            lineHeight: 1.45,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="button" variant="secondary" size="md" disabled={p.confirmBusy} onClick={() => p.onClose()}>
            취소
          </Button>
          <Button type="button" variant="primary" size="md" loading={p.confirmBusy} disabled={p.confirmBusy} onClick={() => p.onConfirm()}>
            프로젝트룸 만들기
          </Button>
        </div>
      </div>
    </div>
  );
}
