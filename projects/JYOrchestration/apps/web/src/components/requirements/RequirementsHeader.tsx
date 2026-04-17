"use client";

import Link from "next/link";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

export type RequirementsMemberChip = {
  memberId: string;
  displayName: string | null;
  email: string | null;
  memberType: string;
};

export function RequirementsHeader({
  projectName,
  descriptionText,
  inviteHref,
  inviteEmphasis,
  members,
  plannerHint,
  onInviteClick,
}: {
  /** 실제 프로젝트명(또는 로딩·오류 시 사람이 읽을 수 있는 짧은 문구). raw projectId 축약 문자열 금지. */
  readonly projectName: string;
  /** 프로젝트 설명 또는 빈 상태/안내 문구. 없으면 빈 문자열로 두고 렌더 생략. */
  readonly descriptionText: string;
  readonly inviteHref: string;
  readonly inviteEmphasis: boolean;
  readonly members: readonly RequirementsMemberChip[];
  /** AI 기획자 등 부가 안내(약한 스타일) */
  readonly plannerHint?: string | null;
  /** 설정 시 멤버 초대는 모달 등으로 처리 (프로젝트 내 사용자 검색) */
  readonly onInviteClick?: () => void;
}) {
  const showScreenLabels = useShowScreenLabels();
  const desc = descriptionText.trim();

  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: "1 1 240px" }}>
        <div className="relative" style={{ position: "relative" }}>
          <ScreenLabel label="요구사항-헤더-프로젝트정보" visible={showScreenLabels} />
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {projectName}
          </div>
          {desc ? (
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, marginTop: 2, whiteSpace: "pre-wrap" }}>{desc}</div>
          ) : null}
          {plannerHint ? (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, lineHeight: 1.45 }}>{plannerHint}</div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", maxWidth: 360 }}>
          {members.slice(0, 8).map((m) => (
            <span
              key={m.memberId}
              title={m.email ?? m.displayName ?? m.memberId}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: m.memberType === "AI" ? "#ede9fe" : "#e0f2fe",
                color: "#1e293b",
                border: "1px solid #e2e8f0",
              }}
            >
              {(m.displayName || m.email || (m.memberType === "AI" ? "AI" : "?")).slice(0, 14)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ position: "relative" }}>
          <ScreenLabel label="요구사항-헤더-멤버초대버튼" visible={showScreenLabels} />
          {onInviteClick ? (
            <button
              type="button"
              onClick={onInviteClick}
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                border: inviteEmphasis ? "2px solid #ea580c" : "1px solid #cbd5e1",
                background: inviteEmphasis ? "#fff7ed" : "#fff",
                color: inviteEmphasis ? "#c2410c" : "#0f172a",
                boxShadow: inviteEmphasis ? "0 0 0 3px rgba(251,146,60,0.25)" : "none",
                cursor: "pointer",
              }}
            >
              멤버 초대
            </button>
          ) : (
            <Link
              href={inviteHref}
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                textDecoration: "none",
                border: inviteEmphasis ? "2px solid #ea580c" : "1px solid #cbd5e1",
                background: inviteEmphasis ? "#fff7ed" : "#fff",
                color: inviteEmphasis ? "#c2410c" : "#0f172a",
                boxShadow: inviteEmphasis ? "0 0 0 3px rgba(251,146,60,0.25)" : "none",
              }}
            >
              멤버 초대
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
