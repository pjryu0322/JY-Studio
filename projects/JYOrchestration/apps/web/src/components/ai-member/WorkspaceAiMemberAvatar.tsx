"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import { workspaceAiAvatarGlyphSvg } from "@/components/ai-member/workspaceAiAvatarGlyphSvg";
import type { WorkspaceAiAvatarGlyphKey, WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";

const wrapStyle = (size: number, accent: string): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: "999px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: "#f8fafc",
  border: `2px solid ${accent}`,
  boxSizing: "border-box",
});

export function WorkspaceAiMemberAvatar(p: {
  readonly memberId?: WorkspaceAiMemberId;
  readonly glyphKey?: WorkspaceAiAvatarGlyphKey;
  readonly accent?: string;
  readonly label?: string;
  /** 카탈로그·참여자 옵션보다 우선(향후 프로젝트별 커스텀 URL) */
  readonly avatarUrl?: string | null;
  readonly size?: number;
  readonly className?: string;
}): ReactNode {
  const size = Math.max(20, Math.min(72, p.size ?? 28));
  const m = p.memberId ? getWorkspaceAiMember(p.memberId) : undefined;
  const glyph = (m?.avatarGlyphKey ?? p.glyphKey ?? "document-strategy") as WorkspaceAiAvatarGlyphKey;
  const accent = m?.avatarAccent ?? p.accent ?? "#64748b";
  const label = (m?.avatarLabel ?? p.label ?? m?.title ?? "AI").trim();
  const urlRaw = (p.avatarUrl ?? m?.avatarUrl ?? "").trim();
  const iconPx = Math.round(size * 0.52);
  const base = wrapStyle(size, accent);
  if (urlRaw) {
    return (
      <span
        className={p.className}
        style={{ ...base, padding: 0, overflow: "hidden" }}
        title={label}
        role="img"
        aria-label={label}
      >
        <img
          src={urlRaw}
          alt=""
          width={size}
          height={size}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return (
    <span
      className={p.className}
      style={base}
      title={label}
      role="img"
      aria-label={label}
    >
      {workspaceAiAvatarGlyphSvg(glyph, accent, iconPx)}
    </span>
  );
}

/** 참여 멤버 목록·모달용 — 사람 행에서는 null */
export function WorkspaceAiParticipantAvatar(p: {
  readonly participant: ParticipantOption;
  readonly size?: number;
  readonly className?: string;
}): ReactNode {
  if (p.participant.kind !== "ai") return null;
  const id = p.participant.platformMemberId;
  if (!id) return null;
  return (
    <WorkspaceAiMemberAvatar
      memberId={id}
      glyphKey={p.participant.aiAvatarGlyphKey}
      accent={p.participant.aiAvatarAccent}
      label={p.participant.aiAvatarLabel}
      avatarUrl={p.participant.aiAvatarUrl ?? null}
      size={p.size}
      className={p.className}
    />
  );
}
